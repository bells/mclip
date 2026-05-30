// 独立 preview 窗口容器：监听主窗口推送的数据，再分发给详情页或分组页。

import { useEffect, useRef, useState } from "react";

import { getTranslations } from "../i18n";
import {
  copyHistoryItem,
  deleteHistoryItem,
  hideHistoryPreviewWindow,
  hideMainWindow,
  listenToHistoryPreviewUpdated,
  notifyHistoryPreviewPointerEntered,
  requestHistoryPreviewClose,
} from "../lib/tauri";
import type { HistoryPreviewPayload } from "../types";
import { HistoryGroupPreviewWindow } from "./HistoryGroupPreviewWindow";
import { HistoryItemPreviewWindow } from "./HistoryItemPreviewWindow";

export function HistoryPreviewWindow() {
  // preview 为 null 时窗口没有可展示数据，组件会返回 null。
  const [preview, setPreview] = useState<HistoryPreviewPayload | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDetailMetaOpen, setIsDetailMetaOpen] = useState(false);
  // ref 适合保存不参与渲染的可变值；这里记录上次通知主窗口的时间。
  const lastPointerNotifyAtRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // preview 窗口不主动读取历史，由主窗口通过事件推送当前分组数据。
    void listenToHistoryPreviewUpdated((payload) => {
      setPreview(payload);
      setHoveredItemId(null);
      setIsDetailMetaOpen(false);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const selectPreviewItem = async (id: string) => {
    try {
      await copyHistoryItem(id);
      await hideHistoryPreviewWindow();
      await hideMainWindow();
    } catch (error) {
      console.error("复制历史分组记录失败:", error);
    }
  };

  const deletePreviewItem = async (id: string) => {
    try {
      await deleteHistoryItem(id);

      // 函数式 setState 可以拿到最新 state，适合基于当前 preview 删除某一项。
      setPreview((currentPreview) => {
        if (!currentPreview) {
          return currentPreview;
        }

        if (currentPreview.kind === "item") {
          if (currentPreview.item.id === id) {
            void hideHistoryPreviewWindow();
            return null;
          }

          return currentPreview;
        }

        const nextItems = currentPreview.items.filter((item) => item.id !== id);

        if (nextItems.length === 0) {
          void hideHistoryPreviewWindow();
          return null;
        }

        return {
          ...currentPreview,
          items: nextItems,
        };
      });
    } catch (error) {
      console.error("删除历史分组记录失败:", error);
    }
  };

  const notifyPointerInside = () => {
    const now = Date.now();

    // Mousemove is chatty; throttle the cross-window signal and let the native
    // hit test in the main window make the final hide decision.
    if (now - lastPointerNotifyAtRef.current < 80) {
      return;
    }

    lastPointerNotifyAtRef.current = now;
    void notifyHistoryPreviewPointerEntered();
  };

  if (!preview) {
    return null;
  }

  const t = getTranslations(preview.language).history;

  if (preview.kind === "item") {
    return (
      <HistoryItemPreviewWindow
        isDetailMetaOpen={isDetailMetaOpen}
        preview={preview}
        translations={t}
        onPointerInside={notifyPointerInside}
        onRequestClose={() => {
          void requestHistoryPreviewClose();
        }}
        onToggleDetailMeta={() => setIsDetailMetaOpen((prev) => !prev)}
      />
    );
  }

  return (
    <HistoryGroupPreviewWindow
      hoveredItemId={hoveredItemId}
      preview={preview}
      translations={t}
      onDeleteItem={(id) => {
        void deletePreviewItem(id);
      }}
      onHoveredItemChange={setHoveredItemId}
      onPointerInside={notifyPointerInside}
      onRequestClose={() => {
        void requestHistoryPreviewClose();
      }}
      onSelectItem={(id) => {
        void selectPreviewItem(id);
      }}
    />
  );
}
