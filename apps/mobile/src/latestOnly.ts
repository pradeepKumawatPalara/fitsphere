/**
 * Runs tasks one at a time, keeping only the newest one waiting (D-72): a task asked for while another
 * runs waits for it to finish, and a newer one asked for meanwhile takes its place, so tasks never pile
 * up. Search foods uses it so a slow phone searches only for the latest text, never for every one typed
 * while a search was under way. A task that fails still lets the next one run; its error goes to
 * `onFailure`, which by default throws it again, so it is reported as before, never swallowed.
 */
export function latestOnly(onFailure: (error: unknown) => void = rethrow): (task: () => Promise<void>) => void {
  let running = false;
  let waiting: (() => Promise<void>) | null = null;

  function run(task: () => Promise<void>) {
    if (running) {
      waiting = task;
      return;
    }
    running = true;
    void task()
      .catch(onFailure)
      .finally(() => {
        running = false;
        const next = waiting;
        waiting = null;
        if (next) run(next);
      });
  }

  return run;
}

function rethrow(error: unknown): never {
  throw error;
}
