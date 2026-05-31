// 独立 preview 窗口容器：监听主窗口推送的数据，再分发给详情页或分组页。

import { useEffect, useRef, useState } from "react";

import { GROUP_PREVIEW_DETAIL_WINDOW_WIDTH, GROUP_PREVIEW_WIDTH } from "../constants";
import { getTranslations } from "../i18n";
import {
  copyHistoryItem,
  deleteHistoryItem,
  hideHistoryPreviewDetailWindow,
  hideHistoryPreviewWindow,
  hideMainWindow,
  listenToHistoryPreviewPlacementUpdated,
  listenToHistoryPreviewUpdated,
  notifyHistoryPreviewPointerEntered,
  requestHistoryPreviewClose,
  showHistoryGroupPreviewWithDetailWindow,
  type PreviewWindowPosition,
  type PreviewWindowSide,
} from "../lib/tauri";
import type { HistoryPreviewPayload } from "../types";
import {
  getGroupDetailPreviewOffset,
  getGroupPreviewHeight,
  getGroupPreviewHeightWithDetail,
  getItemPreviewHeight,
} from "../utils/preview";
import { HistoryGroupPreviewWindow } from "./HistoryGroupPreviewWindow";
import { HistoryItemPreviewWindow } from "./HistoryItemPreviewWindow";

export function HistoryPreviewWindow() {
  // preview 为 null 时窗口没有可展示数据，组件会返回 null。
  const [preview, setPreview] = useState<HistoryPreviewPayload | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [groupPlacement, setGroupPlacement] = useState<PreviewWindowPosition | null>(null);
  const [groupDetailSide, setGroupDetailSide] =
    useState<PreviewWindowSide>("right");
  // ref 适合保存不参与渲染的可变值；这里记录上次通知主窗口的时间。
  const lastPointerNotifyAtRef = useRef(0);
  const latestPlacementRef = useRef<PreviewWindowPosition | null>(null);
  const previewKindRef = useRef<HistoryPreviewPayload["kind"] | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // preview 窗口不主动读取历史，由主窗口通过事件推送当前分组数据。
    void listenToHistoryPreviewUpdated((payload) => {
      previewKindRef.current = payload.kind;
      setPreview(payload);
      setHoveredItemId(null);
      setGroupPlacement(payload.kind === "group" ? latestPlacementRef.current : null);
      setGroupDetailSide("right");
      void hideHistoryPreviewDetailWindow();
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewPlacementUpdated((placement) => {
      latestPlacementRef.current = placement;
      if (previewKindRef.current === "group") {
        setGroupPlacement(placement);
      }
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

  const hoveredItem =
    preview?.kind === "group" && hoveredItemId !== null
      ? preview.items.find((item) => item.id === hoveredItemId) ?? null
      : null;
  const hoveredItemIndex =
    preview?.kind === "group" && hoveredItemId !== null
      ? preview.items.findIndex((item) => item.id === hoveredItemId)
      : -1;
  const groupDetailOffset =
    hoveredItemIndex < 0 ? 0 : getGroupDetailPreviewOffset(hoveredItemIndex);
  const groupPreviewHeight =
    preview?.kind === "group" ? getGroupPreviewHeight(preview.items.length) : null;
  const detailPreviewHeight =
    hoveredItem === null ? null : getItemPreviewHeight(hoveredItem);

  useEffect(() => {
    if (
      !hoveredItem ||
      preview?.kind !== "group" ||
      !groupPlacement ||
      groupPreviewHeight === null ||
      detailPreviewHeight === null
    ) {
      void hideHistoryPreviewDetailWindow().catch((error) => {
        console.error("隐藏历史分组详情预览失败:", error);
      });
      return;
    }

    void showHistoryGroupPreviewWithDetailWindow(
      groupPlacement.x,
      groupPlacement.y,
      getGroupPreviewHeightWithDetail(
        preview.items.length,
        detailPreviewHeight,
        hoveredItemIndex,
      ),
      GROUP_PREVIEW_WIDTH,
      GROUP_PREVIEW_DETAIL_WINDOW_WIDTH,
    )
      .then((placement) => setGroupDetailSide(placement.side))
      .catch((error) => {
        console.error("显示历史分组详情预览失败:", error);
      });
  }, [
    detailPreviewHeight,
    groupPlacement,
    groupPreviewHeight,
    hoveredItem,
    hoveredItemIndex,
    preview,
  ]);

  if (!preview) {
    return null;
  }

  const t = getTranslations(preview.language).history;

  if (preview.kind === "item") {
    return (
      <HistoryItemPreviewWindow
        preview={preview}
        translations={t}
        onPointerInside={notifyPointerInside}
        onRequestClose={() => {
          void requestHistoryPreviewClose();
        }}
      />
    );
  }

  return (
    <HistoryGroupPreviewWindow
      hoveredItemId={hoveredItemId}
      hoveredItem={hoveredItem}
      detailSide={groupDetailSide}
      detailOffset={groupDetailOffset}
      detailPreviewHeight={detailPreviewHeight}
      groupPreviewHeight={groupPreviewHeight ?? getGroupPreviewHeight(preview.items.length)}
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
