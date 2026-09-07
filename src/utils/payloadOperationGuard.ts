// A new payload invalidates completions, but never permits two writes in flight.
export function createPayloadOperationGuard() {
  let revision = 0;
  let busy = false;
  return {
    invalidate() { revision += 1; },
    begin(): number | null {
      if (busy) return null;
      busy = true;
      return revision;
    },
    isCurrent(token: number) { return token === revision; },
    finish() { busy = false; },
  };
}
