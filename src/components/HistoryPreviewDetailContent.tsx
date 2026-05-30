// preview 中复用的历史内容展示：详情页和分组 hover 详情都会用到。

import { getTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
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
      <div className="app-history-detail-image-wrap">
        <ImageThumb
          alt={item.displayText}
          className="app-history-detail-image"
          imagePath={item.imagePath}
        />
        <div className="app-history-detail-image-caption">
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
      <div className="app-history-detail-files">
        {item.filePaths.map((filePath) => (
          <div className="app-history-detail-file" key={filePath}>
            {filePath}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-history-detail-content">
      {item.text}
    </div>
  );
}
