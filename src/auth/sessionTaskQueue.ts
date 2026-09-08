/** Keep session saves and logout cleanup in order, including slow native storage writes. */
export function createSessionTaskQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      // A failed save must not prevent a later logout or login from reaching storage.
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
