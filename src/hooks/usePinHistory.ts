import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { toggleHistoryItemPinned } from "../services/ipc/commands";
import { sendPinFailureNotice } from "../services/ipc/events";
import { createPinActionController } from "../utils/pinHistory";

export function usePinHistory(context: unknown) {
  const [isPinPending, setPending] = useState(false);
  const controller = useMemo(() => createPinActionController({
    toggle: toggleHistoryItemPinned,
    isVisible: () => getCurrentWindow().isVisible(),
    report: (notice) => sendPinFailureNotice(
      getCurrentWindow().label === "image-viewer" ? "image-viewer" : "main", notice,
    ),
    onPending: setPending,
  }), []);
  useEffect(() => {
    controller.invalidate();
    setPending(false);
    return () => controller.invalidate();
  }, [context, controller]);
  return { isPinPending, togglePin: controller.toggle };
}
