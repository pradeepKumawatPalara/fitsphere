import { latestOnly } from './latestOnly';

// D-72: Search foods runs one search at a time, and only the latest text waits for it.

/** A task that records when it starts and finishes when `finish` is called. */
function task(name: string, log: string[]) {
  let finish: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return {
    run: async () => {
      log.push(`start ${name}`);
      await done;
      log.push(`end ${name}`);
    },
    finish: () => finish(),
    fail: (error: Error) => fail(error),
  };
}

const settle = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('D-72 latestOnly', () => {
  it('runs a task at once when none is running', async () => {
    const log: string[] = [];
    const run = latestOnly();
    const a = task('a', log);
    run(a.run);
    expect(log).toEqual(['start a']);
    a.finish();
    await settle();
    expect(log).toEqual(['start a', 'end a']);
  });

  it('keeps only the newest task waiting while one runs, and runs it after', async () => {
    const log: string[] = [];
    const run = latestOnly();
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name) => task(name, log));
    run(a!.run);
    run(b!.run);
    run(c!.run);
    run(d!.run);
    expect(log).toEqual(['start a']);

    a!.finish();
    await settle();
    expect(log).toEqual(['start a', 'end a', 'start d']);
    d!.finish();
    await settle();
    expect(log).toEqual(['start a', 'end a', 'start d', 'end d']);
    // b and c were replaced and never ran.
  });

  it('reports a task that fails, and still runs the waiting one', async () => {
    const log: string[] = [];
    const failed = jest.fn();
    const run = latestOnly(failed);
    const a = task('a', log);
    const b = task('b', log);
    run(a.run);
    run(b.run);
    const error = new Error('synthetic failure');
    a.fail(error);
    await settle();
    expect(failed).toHaveBeenCalledWith(error);
    expect(log).toEqual(['start a', 'start b']);
    b.finish();
    await settle();
    expect(log).toEqual(['start a', 'start b', 'end b']);
  });
});
