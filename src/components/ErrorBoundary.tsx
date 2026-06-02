import { Component, type ErrorInfo, type ReactNode } from "react";

import { logClientError } from "../utils/diagnostics";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logClientError(
      "react.errorBoundary",
      `${error.name}: ${error.message} | ${info.componentStack ?? ""}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-frame">
          <div className="app-panel app-error-panel" role="alert">
            <span className="app-error-title">mclip failed to render</span>
            <span className="app-error-copy">
              Please open About and copy diagnostics after restarting.
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
