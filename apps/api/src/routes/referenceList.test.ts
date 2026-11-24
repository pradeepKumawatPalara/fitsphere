import { gunzipSync } from 'node:zlib';
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { referenceList, type BuiltList } from './referenceList.ts';

// D-126: a list answered from its stored version, read once per generation, kept in memory and its
// version written back (docs/plans/reference-list-egress.md). A fake database stands in for
// app.reference_lists; the list's own tables are the fake `build`. Synthetic values.

type Row = { generation: number; version: string | null };

function fakeDatabase(row: Row, options: { failWriteBack?: boolean } = {}) {
  const sql: string[] = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      sql.push(text);
      if (text.startsWith('select generation, version from app.reference_lists')) {
        return { rows: [{ generation: String(row.generation), version: row.version }] };
      }
      if (text.startsWith('update app.reference_lists')) {
        if (options.failWriteBack) throw new Error('lock timeout');
        const [version, , generation] = values as [string, string, string];
        if (String(row.generation) === generation && row.version !== version) row.version = version;
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const db = { query: client.query, connect: async () => client } as unknown as Pick<pg.Pool, 'query' | 'connect'>;
  return { db, sql, row };
}

/** The list's content: what `build` reads now. A gate holds a read part-way, to start others meanwhile. */
function fakeList() {
  const state = { content: 'A', reads: 0, gate: null as Promise<void> | null, fail: false };
  async function build(): Promise<BuiltList> {
    state.reads += 1;
    const seen = state.content;
    if (state.gate) await state.gate;
    if (state.fail) {
      state.fail = false;
      throw new Error('read failed');
    }
    return { version: `ver-${seen}`, body: { version: `ver-${seen}`, items: [{ name: `Test food ${seen}` }] } };
  }
  return { state, build };
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

const readsTables = (sql: string[]) => sql.filter((text) => text.startsWith('begin isolation level repeatable read read only')).length;

describe('D-126 a reference list answered from its stored version', () => {
  it('answers a phone holding the stored version with one small read and nothing else', async () => {
    const { db, sql } = fakeDatabase({ generation: 3, version: 'ver-A' });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    expect(await lists.answer('ver-A')).toEqual({ current: true, version: 'ver-A' });
    expect(sql).toEqual(['select generation, version from app.reference_lists where name = $1']);
    expect(list.state.reads).toBe(0);
  });

  it('sends a phone that is behind the whole list, plain and gzipped alike, and stores its version', async () => {
    const { db, row } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    const answer = await lists.answer(undefined);
    if (answer.current) throw new Error('expected the list');
    expect(answer.version).toBe('ver-A');
    expect(JSON.parse(answer.json.toString('utf8'))).toEqual({ version: 'ver-A', items: [{ name: 'Test food A' }] });
    expect(gunzipSync(answer.gzipped).equals(answer.json)).toBe(true);
    await lists.settled();
    expect(row.version).toBe('ver-A');
  });

  it('answers a current phone whose version is not stored yet after reading the list once', async () => {
    const { db, row } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    expect(await lists.answer('ver-A')).toEqual({ current: true, version: 'ver-A' });
    expect(list.state.reads).toBe(1);
    await lists.settled();
    expect(row.version).toBe('ver-A');
  });

  it('keeps the list for its generation: a second phone that is behind reads nothing more', async () => {
    const { db } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    await lists.answer(undefined);
    await lists.settled();
    expect((await lists.answer('ver-old')).current).toBe(false);
    expect(list.state.reads).toBe(1);
  });

  it('reads the list again once it changed, and gives the new version', async () => {
    const { db, row } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });
    await lists.answer(undefined);
    await lists.settled();

    // As migration 0038's triggers do: the next generation, its version not known yet.
    Object.assign(row, { generation: 4, version: null });
    list.state.content = 'B';
    const answer = await lists.answer('ver-A');
    expect(answer).toMatchObject({ current: false, version: 'ver-B' });
    expect(list.state.reads).toBe(2);
    await lists.settled();
    expect(row.version).toBe('ver-B');
  });

  it('reads once for requests that come at once', async () => {
    const { db, sql } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    const answers = await Promise.all([lists.answer(undefined), lists.answer('ver-A'), lists.answer('ver-old')]);
    expect(answers.map((answer) => answer.current)).toEqual([false, true, false]);
    expect(list.state.reads).toBe(1);
    expect(readsTables(sql)).toBe(1);
  });

  it('does not use a read that began before the change a request saw: it reads once more', async () => {
    const { db, row } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    const held = gate();
    list.state.gate = held.promise;
    const early = lists.answer(undefined); // reads generation 3, content A, then waits at the gate
    await new Promise((resolve) => setTimeout(resolve, 0));
    Object.assign(row, { generation: 4, version: null });
    list.state.content = 'B';
    const late = lists.answer(undefined); // sees generation 4 and waits for the read under way
    await new Promise((resolve) => setTimeout(resolve, 0));
    list.state.gate = null;
    held.open();

    expect(await early).toMatchObject({ current: false, version: 'ver-A' });
    expect(await late).toMatchObject({ current: false, version: 'ver-B' });
    expect(list.state.reads).toBe(2);
  });

  it('writes nothing back when the stored version is already the one read', async () => {
    const { db, sql } = fakeDatabase({ generation: 3, version: 'ver-A' });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    expect((await lists.answer('ver-old')).current).toBe(false);
    await lists.settled();
    expect(sql.some((text) => text.startsWith('update app.reference_lists'))).toBe(false);
  });

  it('fails the requests waiting for a read that failed, and reads again for the next', async () => {
    const { db } = fakeDatabase({ generation: 3, version: null });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    list.state.fail = true;
    await expect(lists.answer(undefined)).rejects.toThrow('read failed');
    expect((await lists.answer(undefined)).current).toBe(false);
    expect(list.state.reads).toBe(2);
  });

  it('answers the phone even when the version cannot be written back', async () => {
    const { db, row } = fakeDatabase({ generation: 3, version: null }, { failWriteBack: true });
    const list = fakeList();
    const lists = referenceList({ name: 'foods', db, build: list.build });

    expect(await lists.answer('ver-A')).toEqual({ current: true, version: 'ver-A' });
    await lists.settled();
    expect(row.version).toBeNull();
  });

  it('logs each read with the list, its generation and the time taken, and no value', async () => {
    const { db } = fakeDatabase({ generation: 7, version: null });
    const list = fakeList();
    const lines: { fields: Record<string, unknown>; message: string }[] = [];
    const lists = referenceList({ name: 'exercises', db, build: list.build, log: { info: ((fields: Record<string, unknown>, message: string) => lines.push({ fields, message })) as never } });

    await lists.answer(undefined);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toBe('reference list built');
    expect(Object.keys(lines[0]!.fields).sort()).toEqual(['durationMs', 'generation', 'list']);
    expect(lines[0]!.fields).toMatchObject({ list: 'exercises', generation: 7 });
    expect(JSON.stringify(lines)).not.toContain('Test food');
  });
});
