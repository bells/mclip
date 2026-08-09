import type { ComponentType } from "react";

export type WindowRouteModule = {
  default: ComponentType;
};

type WindowRouteLoader = () => Promise<WindowRouteModule>;

const windowRouteLoaders = {
  about: () => import("./components/AboutWindow").then(
    ({ AboutWindow }) => ({ default: AboutWindow }),
  ),
  "image-viewer": () => import("./components/FullscreenImageViewer").then(
    ({ FullscreenImageViewer }) => ({ default: FullscreenImageViewer }),
  ),
  main: () => import("./App"),
  preferences: () => import("./components/PreferencesWindow").then(
    ({ PreferencesWindow }) => ({ default: PreferencesWindow }),
  ),
  preview: () => import("./components/HistoryPreviewWindow").then(
    ({ HistoryPreviewWindow }) => ({ default: HistoryPreviewWindow }),
  ),
  "preview-detail": () => import("./components/HistoryPreviewDetailWindow").then(
    ({ HistoryPreviewDetailWindow }) => ({ default: HistoryPreviewDetailWindow }),
  ),
} satisfies Record<string, WindowRouteLoader>;

export type WindowRouteLabel = keyof typeof windowRouteLoaders;

export function loadWindowRoute(windowLabel: string): Promise<WindowRouteModule> {
  const routeLoader = windowRouteLoaders[
    windowLabel as WindowRouteLabel
  ] ?? windowRouteLoaders.main;

  return routeLoader();
}
