import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import { packJson, type PackedJson } from './largeJson.ts';

// GET /v1/foods and GET /v1/exercises answered from app.reference_lists (D-126,
// docs/plans/reference-list-egress.md). Migration 0038's triggers add 1 to a list's generation, and clear
// its version, whenever one of the list's tables changes. A phone whose version is the stored one is
// answered after one small read, with no other query: nearly every call, since the phone asks after each
// sync. Otherwise the list is read once per generation in this process, inside one read-only,
// repeatable-read transaction (its generation and its rows from one moment), kept in memory packed, and
// its version written back for the next request, here or on another instance (a cold start included).

export type ReferenceListName = 'foods' | 'exercises';

/** The list as the phone receives it: its version (a hash of every value it holds) and the whole response. */
export type BuiltList = { version: string; body: unknown };

/** The answer to one phone: its copy is current, or the list to send. */
export type ListAnswer = { current: true; version: string } | ({ current: false; version: string } & PackedJson);

export type ReferenceList = {
  /** `phoneVersion`: the version the phone holds, if any. */
  answer(phoneVersion: string | undefined): Promise<ListAnswer>;
  /** Resolves once no write-back is under way. Nothing waits for one but the tests. */
  settled(): Promise<void>;
};

type StoredRow = { generation: string; version: string | null };
type Stored = { generation: bigint; version: string | null };
type Kept = { generation: bigint; version: string } & PackedJson;

const READ_STORED = 'select generation, version from app.reference_lists where name = $1';
// Only at the generation the list was read at: a change meanwhile is never given the old version.
const WRITE_BACK = `update app.reference_lists set version = $1
  where name = $2 and generation = $3 and version is distinct from $1`;
// An import holds the list's row until it commits: a write-back gives up after this rather than hold a
// connection, and a later request writes it.
const WRITE_BACK_LOCK_TIMEOUT = '2s';

export function referenceList(options: {
  name: ReferenceListName;
  db: Pick<pg.Pool, 'query' | 'connect'>;
  /** Reads the list's tables with `client`, inside the read's transaction; changes nothing. */
  build(client: pg.ClientBase): Promise<BuiltList>;
  /** One line per read: the list, its generation and the time taken; never a value. */
  log?: Pick<FastifyBaseLogger, 'info'>;
}): ReferenceList {
  const { name, db } = options;
  // The list last read, with its generation: one per list in this process, replaced by the next read.
  let kept: Kept | null = null;
  // The read under way: a request that needs the list meanwhile waits for it rather than read it too.
  let building: Promise<Kept> | null = null;
  const writing = new Set<Promise<void>>();

  async function answer(phoneVersion: string | undefined): Promise<ListAnswer> {
    const stored = storedOf((await db.query<StoredRow>(READ_STORED, [name])).rows, name);
    if (stored.version !== null && stored.version === phoneVersion) return { current: true, version: stored.version };
    const list = await listAt(stored.generation);
    if (list.version === phoneVersion) return { current: true, version: list.version };
    return { current: false, version: list.version, json: list.json, gzipped: list.gzipped };
  }

  /** The list at `generation` or later: the one kept, the one being read, or a new read. */
  async function listAt(generation: bigint): Promise<Kept> {
    if (kept?.generation === generation) return kept;
    const first = await (building ??= startBuild());
    if (first.generation >= generation) return first;
    // That read began before the change this request saw: once more, from now.
    return (building ??= startBuild());
  }

  function startBuild(): Promise<Kept> {
    return build().finally(() => {
      building = null;
    });
  }

  async function build(): Promise<Kept> {
    const started = performance.now();
    const { stored, list } = await readInOneMoment();
    const read: Kept = { generation: stored.generation, version: list.version, ...(await packJson(list.body)) };
    kept = read;
    if (stored.version !== list.version) track(writeBack(read));
    options.log?.info(
      { list: name, generation: Number(read.generation), durationMs: Math.round(performance.now() - started) },
      'reference list built',
    );
    return read;
  }

  /** The generation and every row of the list as of one moment: a change committed meanwhile is the next generation's. */
  async function readInOneMoment(): Promise<{ stored: Stored; list: BuiltList }> {
    const client = await db.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const stored = storedOf((await client.query<StoredRow>(READ_STORED, [name])).rows, name);
      const list = await options.build(client);
      await client.query('commit');
      return { stored, list };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Stores the version read for the next request; never fails a request, which does not wait for it. */
  async function writeBack(read: Kept): Promise<void> {
    let client: pg.PoolClient | null = null;
    try {
      client = await db.connect();
      await client.query('begin');
      await client.query(`set local lock_timeout = '${WRITE_BACK_LOCK_TIMEOUT}'`);
      await client.query(WRITE_BACK, [read.version, name, read.generation.toString()]);
      await client.query('commit');
    } catch {
      // An import holding the row, or the database out of reach: the next read tries again.
      await client?.query('rollback').catch(() => undefined);
    } finally {
      client?.release();
    }
  }

  function track(work: Promise<void>) {
    writing.add(work);
    void work.finally(() => writing.delete(work));
  }

  return {
    answer,
    async settled() {
      await Promise.all([...writing]);
    },
  };
}

function storedOf(rows: StoredRow[], name: ReferenceListName): Stored {
  const row = rows[0];
  if (!row) throw new Error(`app.reference_lists has no row for "${name}" (migration 0038)`);
  return { generation: BigInt(row.generation), version: row.version };
}
