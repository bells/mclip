export type PreviewOpenRequest = {
  revision: number;
};

export type PreviewDismissalState = {
  isSelectionDismissed: boolean;
  revision: number;
};

export function createPreviewDismissalState(): PreviewDismissalState {
  return {
    isSelectionDismissed: false,
    revision: 0,
  };
}

export function beginPreviewOpenRequest(
  state: PreviewDismissalState,
): PreviewOpenRequest {
  return {
    revision: state.revision,
  };
}

export function canStartPreviewOpenRequest(
  state: PreviewDismissalState,
): boolean {
  return !state.isSelectionDismissed;
}

export function canCompletePreviewOpenRequest(
  state: PreviewDismissalState,
  request: PreviewOpenRequest,
): boolean {
  return !state.isSelectionDismissed && state.revision === request.revision;
}

export function dismissPreviewForSelection(
  state: PreviewDismissalState,
): PreviewDismissalState {
  return {
    isSelectionDismissed: true,
    revision: state.revision + 1,
  };
}

export function cancelPreviewOpenRequests(
  state: PreviewDismissalState,
): PreviewDismissalState {
  return {
    ...state,
    revision: state.revision + 1,
  };
}

export function resetPreviewSelectionDismissal(
  state: PreviewDismissalState,
): PreviewDismissalState {
  return {
    isSelectionDismissed: false,
    revision: state.revision + 1,
  };
}
