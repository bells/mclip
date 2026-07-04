// preview 中复用的历史内容展示：详情页和分组 hover 详情都会用到。

import { getTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { ui } from "../uiStyles";
import { getTextHistoryAffordance } from "../utils/historyAffordance";
import { ImageThumb } from "./ImageThumb";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryPreviewDetailContentProps = {
  item: HistoryListItem;
  translations: HistoryTranslations;
};

export function HistoryPreviewDetailContent({
  item,
  translations,
}: HistoryPreviewDetailContentProps) {
  // HistoryListItem 是联合类型，判断 kind 后 TypeScript 会自动收窄字段类型。
  if (item.kind === "image") {
    return (
      <div className={ui.historyDetailImageWrap}>
        <ImageThumb
          alt={item.displayText}
          className={ui.historyDetailImage}
          imagePath={item.imagePath}
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
      {textAffordance?.kind === "emoji" ? (
        <div className={ui.historyDetailAffordance}>
          <span className={ui.historyAffordance} aria-hidden="true">
            <span className={ui.historyEmojiBadge}>
              {textAffordance.emoji}
            </span>
          </span>
        </div>
      ) : null}
      <span>{item.text}</span>
    </div>
  );
}
