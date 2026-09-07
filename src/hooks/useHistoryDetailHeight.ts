import { useLayoutEffect, useRef } from "react";

import { resizeHistoryDetailWindow } from "../services/ipc/commands";
import { listenToHistoryPreviewPlacementUpdated } from "../services/ipc/events";
import { getItemPreviewNaturalHeight } from "../utils/preview";

export function useHistoryDetailHeight(enabled: boolean, item: object) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    const header = panel.querySelector<HTMLElement>("[data-detail-header]");
    const content = panel.querySelector<HTMLElement>("[data-detail-natural-content]");
    const region = panel.querySelector<HTMLElement>("[data-detail-content-region]");
    const footer = panel.querySelector<HTMLElement>("[data-detail-footer]");
    if (!header || !content || !region || !footer) return;

    let disposed = false;
    let frame = 0;
    let lastHeight: number | null = null;
    let unlisten: (() => void) | undefined;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const style = getComputedStyle(region);
        const panelStyle = getComputedStyle(panel);
        const chrome = [style.paddingTop, style.paddingBottom, style.borderTopWidth,
          style.borderBottomWidth, panelStyle.borderTopWidth, panelStyle.borderBottomWidth]
          .reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
        const height = getItemPreviewNaturalHeight(
          header.getBoundingClientRect().height,
          content.getBoundingClientRect().height,
          footer.getBoundingClientRect().height,
          chrome,
        );
        if (height === null || height === lastHeight) return;
        lastHeight = height;
        void resizeHistoryDetailWindow(height).catch(() => {
          if (!disposed) lastHeight = null;
        });
      });
    };
    // Observe intrinsic content, never the viewport-filled scrolling region.
    const observer = new ResizeObserver(measure);
    for (const element of [header, content, footer]) observer.observe(element);
    void listenToHistoryPreviewPlacementUpdated(() => {
      lastHeight = null;
      measure();
    }).then((unsubscribe) => {
      if (disposed) unsubscribe();
      else {
        unlisten = unsubscribe;
        measure();
      }
    });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      unlisten?.();
    };
  }, [enabled, item]);

  return panelRef;
}
