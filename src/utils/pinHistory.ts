import type { PinFailureNotice } from "../types";

export function getPinFailureNotice(error: unknown): PinFailureNotice {
  if (typeof error === "object" && error !== null && "code" in error &&
      error.code === "pinnedHistoryLimitReached" && "current" in error && "max" in error &&
      typeof error.current === "number" && Number.isSafeInteger(error.current) && error.current >= 0 &&
      typeof error.max === "number" && Number.isInteger(error.max) && error.max >= 5 && error.max <= 20 &&
      error.current >= error.max) {
    return { code: error.code, current: error.current, max: error.max };
  }
  return { code: "historyMutationFailed" };
}

export function getNumericHistoryTargetId(
  items: readonly { id: string; isPinned: boolean }[],
  context: { key: string; hasModifier: boolean; isEditing: boolean; isComposing: boolean; repeat: boolean; blocked: boolean },
): string | null {
  if (context.hasModifier || context.isEditing || context.isComposing || context.repeat || context.blocked || !/^[0-9]$/.test(context.key)) return null;
  const index = context.key === "0" ? 9 : Number(context.key) - 1;
  return items.filter((item) => !item.isPinned)[index]?.id ?? null;
}

export function createPinActionController(dependencies: {
  toggle: (id: string) => Promise<unknown>;
  isVisible: () => Promise<boolean>;
  report: (notice: PinFailureNotice) => Promise<unknown>;
  onPending: (pending: boolean) => void;
}) {
  let generation = 0;
  let pending = false;
  return {
    invalidate() { generation += 1; pending = false; },
    async toggle(id: string) {
      if (pending) return;
      const request = generation;
      pending = true;
      dependencies.onPending(true);
      try {
        await dependencies.toggle(id);
      } catch (error: unknown) {
        try {
          if (request === generation && await dependencies.isVisible() && request === generation) {
            await dependencies.report(getPinFailureNotice(error));
          }
        } catch {
          // A disappearing window or event target must not revive a stale preview.
        }
      } finally {
        if (request === generation) {
          pending = false;
          dependencies.onPending(false);
        }
      }
    },
  };
}
