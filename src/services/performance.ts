import { invoke } from "@tauri-apps/api/core";

import type {
  PerformanceMilestone,
  PerformanceMilestoneName,
  PerformanceOutcome,
  PerformanceWindowLabel,
} from "../types";

const frontendBootstrapStartedAt = performance.now();
let performanceModePromise: Promise<boolean> | null = null;

type FrontendMilestoneOptions = {
  elapsedMs?: number;
  fixtureSize?: number | null;
  interactionId?: string | null;
  outcome?: PerformanceOutcome;
  windowLabel?: PerformanceWindowLabel | null;
};

function isPerformanceModeEnabled() {
  performanceModePromise ??= invoke<boolean>("is_performance_mode_enabled").catch(
    () => false,
  );
  return performanceModePromise;
}

export function millisecondsSinceFrontendBootstrap() {
  return performance.now() - frontendBootstrapStartedAt;
}

export function createPerformanceInteractionId(prefix: string) {
  const normalizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "event";
  return `${normalizedPrefix}-${Date.now().toString(36)}`;
}

export async function recordFrontendPerformance(
  milestone: PerformanceMilestoneName,
  options: FrontendMilestoneOptions = {},
) {
  if (!(await isPerformanceModeEnabled())) {
    return;
  }

  const payload: PerformanceMilestone = {
    clock: "frontend",
    elapsedMs: options.elapsedMs ?? millisecondsSinceFrontendBootstrap(),
    fixtureSize: options.fixtureSize ?? null,
    interactionId: options.interactionId ?? null,
    milestone,
    outcome: options.outcome ?? "success",
    windowLabel: options.windowLabel ?? null,
  };

  await invoke<void>("record_frontend_performance", { milestone: payload });
}

export function recordFrontendPerformanceAfterPaint(
  milestone: PerformanceMilestoneName,
  options: FrontendMilestoneOptions = {},
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void recordFrontendPerformance(milestone, options);
    });
  });
}
