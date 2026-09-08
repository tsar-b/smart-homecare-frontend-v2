/** Owns one read request so a superseded response cannot overwrite newer UI state. */
export class LatestRequest {
  private controller: AbortController | null = null;

  start() {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.controller === controller && !controller.signal.aborted,
    };
  }

  cancel() {
    this.controller?.abort();
    this.controller = null;
  }
}
