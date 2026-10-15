/** Runs one task at a time: a call made while the previous task has not settled is dropped (it resolves to `undefined` at once) */
export function createSingleFlight() {
  let running = false;
  return async function once<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    try {
      return await task();
    } finally {
      running = false;
    }
  };
}
