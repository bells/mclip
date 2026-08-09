// 每个 Tauri WebView 共享这个小型入口，但只动态加载当前 window label 的路由。
import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import { installClientErrorLogging } from "./utils/diagnostics";
import { getCurrentWindowLabel } from "./services/ipc/windows";
import { recordFrontendPerformanceAfterPaint } from "./services/performance";
import type { PerformanceWindowLabel } from "./types";
import { loadWindowRoute } from "./windowRoutes";

installClientErrorLogging();
const windowLabel = getCurrentWindowLabel();
// index.html 固定提供 root 节点，所有 window route 共用同一个诊断边界。
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
recordFrontendPerformanceAfterPaint("bootstrapReady", {
  windowLabel: windowLabel as PerformanceWindowLabel,
});

function renderWindowRoot(WindowRoot: React.ComponentType) {
  root.render(
    // StrictMode 只在开发环境额外检查副作用和过时写法，不会渲染真实 DOM 元素。
    <React.StrictMode>
      <ErrorBoundary>
        <WindowRoot />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

function WindowRouteLoadFailure({ error }: { error: unknown }): React.ReactNode {
  throw error;
}

void loadWindowRoute(windowLabel).then(
  ({ default: WindowRoot }) => {
    recordFrontendPerformanceAfterPaint("routeReady", {
      windowLabel: windowLabel as PerformanceWindowLabel,
    });
    renderWindowRoot(WindowRoot);
  },
  (error: unknown) => {
    renderWindowRoot(() => <WindowRouteLoadFailure error={error} />);
  },
);
