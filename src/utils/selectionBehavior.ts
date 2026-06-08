// 历史选择后的附加行为。保持纯函数，方便在不启动 Tauri 的情况下测试。

export function shouldAutoPasteAfterHistorySelection(settings: { autoPaste: boolean }) {
  return settings.autoPaste;
}
