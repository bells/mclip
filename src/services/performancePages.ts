// Loaded dynamically only in explicit performance mode. Uses synthetic inputs.
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindowLabel } from "./ipc/windows";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { transformText } from "./ipc/commands";
import { updateQuickActionWindow } from "./ipc/events";
import { recordFrontendPerformance } from "./performance";
import type { AppSettings, PerformancePageRequest, PerformanceWindowLabel } from "../types";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function waitFor<T>(read: () => T | null | false): Promise<T> {
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    const value = read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("pageProbeDomTimedOut");
}
async function painted(interactionId: string, outcome: "success" | "failure" = "success") {
  if (outcome === "success") {
    const deadline = performance.now() + 5000;
    while (!(await getCurrentWindow().isVisible())) {
      if (performance.now() > deadline) { outcome = "failure"; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  if (outcome === "success") { await frame(); await frame(); }
  await recordFrontendPerformance("pagePainted", {
    interactionId, outcome, windowLabel: getCurrentWindowLabel() as PerformanceWindowLabel,
  });
}
function inputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", {bubbles: true}));
}
async function perform({ action, interactionId }: PerformancePageRequest) {
  if (action === "openQuickAction") {
    const result = await transformText({ action: "jsonPrettify", input: '{"fixture":[1,2,3],"label":"synthetic"}' });
    await updateQuickActionWindow({...result, targetId: "perf-000", language: "en", appearanceTheme: "light"});
    await waitFor(() => document.querySelector("pre")?.textContent === result.output);
  } else if (action === "preferencesSave") {
    const button = await waitFor(() => document.querySelector<HTMLButtonElement>('#preference-setting-appearance-item-numbers button[role="switch"]'));
    const expected = button.getAttribute("aria-checked") !== "true";
    let saved = false;
    const unsubscribe = await listen<AppSettings>("settings-updated", ({payload}) => { saved = payload.showHistoryItemNumbers === expected; });
    try {
      button.click();
      await waitFor(() => saved && button.getAttribute("aria-checked") === String(expected));
    } finally { unsubscribe(); }
  } else if (action.startsWith("preferences") && action !== "preferencesSearch") {
    const names = ["preferencesGeneral", "preferencesAppearance", "preferencesHistory", "preferencesPrivacy", "preferencesTextActions", "preferencesCli"];
    const index = names.indexOf(action);
    if (index < 0) throw new Error("pageProbeInvalidAction");
    const search = document.querySelector<HTMLInputElement>('aside input');
    if (search?.value) {
      inputValue(search, "");
      await waitFor(() => document.querySelectorAll("aside nav button").length === 6);
    }
    const button = await waitFor(() => document.querySelectorAll<HTMLButtonElement>("aside nav button")[index]);
    button.click();
    await waitFor(() => document.querySelectorAll("aside nav button")[index]?.getAttribute("aria-current") === "page");
  } else if (action === "preferencesSearch") {
    const search = await waitFor(() => document.querySelector<HTMLInputElement>('aside input'));
    inputValue(search, "history");
    await waitFor(() => !document.querySelector("aside nav") && document.querySelector("aside button"));
  } else {
    await waitFor(() => document.querySelector("#root button"));
  }
  await painted(interactionId);
}

export async function installPerformancePageProbe() {
  await listen<PerformancePageRequest>("performance-page-action", ({payload}) => {
    void perform(payload).catch(() => painted(payload.interactionId, "failure"));
  }, {target: getCurrentWindowLabel()});
  await recordFrontendPerformance("pageProbeReady", {windowLabel: getCurrentWindowLabel() as PerformanceWindowLabel});
}
