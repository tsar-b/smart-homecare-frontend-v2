/** Lock immediately; React's pending state may not render before another submit event. */
export function createSubmissionLock() {
  let pending = false;
  return {
    tryAcquire(): boolean {
      if (pending) return false;
      pending = true;
      return true;
    },
    release(): void {
      pending = false;
    },
  };
}
