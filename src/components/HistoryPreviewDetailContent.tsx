// preview 中复用的历史内容展示：详情页和分组 hover 详情都会用到。

import { getTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { ui } from "../uiStyles";
import { getTextHistoryAffordance } from "../utils/historyAffordance";
import { ImageThumb } from "./ImageThumb";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryPreviewDetailContentProps = {
  item: HistoryListItem;
  presentation?: "compact" | "viewer";
  translations: HistoryTranslations;
};

export function HistoryPreviewDetailContent({
  item,
  presentation = "compact",
  translations,
}: HistoryPreviewDetailContentProps) {
  // HistoryListItem 是联合类型，判断 kind 后 TypeScript 会自动收窄字段类型。
  if (item.kind === "image") {
    const isViewer = presentation === "viewer";

    return (
      <div
        className={[
          ui.historyDetailImageWrap,
          isViewer ? ui.historyDetailImageViewerWrap : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ImageThumb
          alt={item.displayText}
          className={
            isViewer ? ui.historyDetailImageViewer : ui.historyDetailImage
          }
          errorFallback={(
            <div
              className={
                isViewer
                  ? ui.historyDetailImageViewerError
                  : ui.historyDetailImageError
              }
              role="status"
            >
              {translations.imageLoadError}
            </div>
          )}
          imagePath={item.imagePath}
          loadingFallback={(
            <div
              aria-live="polite"
              className={
                isViewer
                  ? ui.historyDetailImageViewerLoading
                  : ui.historyDetailImageLoading
              }
              role="status"
            >
              {translations.imageLoading}
            </div>
          )}
        />
        <div className={ui.historyDetailImageCaption}>
          {translations.imageSizeLabel(item.width, item.height)} · {item.byteSize > 1024 * 1024
            ? `${(item.byteSize / (1024 * 1024)).toFixed(1)} MB`
            : item.byteSize > 1024
              ? `${(item.byteSize / 1024).toFixed(0)} KB`
              : `${item.byteSize} B`}
        </div>
      </div>
    );
  }

  if (item.kind === "files") {
    return (
      <div className={ui.historyDetailFiles}>
        {item.filePaths.map((filePath) => (
          <div className={ui.historyDetailFile} key={filePath}>
            {filePath}
          </div>
        ))}
      </div>
    );
  }

  const textAffordance = getTextHistoryAffordance(item.text);

  if (textAffordance?.kind === "emoji") {
    return (
      <div className={ui.historyDetailContent}>
        <span className={ui.historyAffordance}>
          <span className={ui.historyEmojiBadge}>{textAffordance.emoji}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={ui.historyDetailContent}>
      {textAffordance?.kind === "color" ? (
        <div className={ui.historyDetailAffordance}>
          <span className={ui.historyAffordance} aria-hidden="true">
            <span
              className={ui.historyColorSwatch}
              style={{ background: textAffordance.color }}
            />
          </span>
          <span>{textAffordance.color}</span>
        </div>
      ) : null}
      <span>{item.text}</span>
    </div>
  );
}
