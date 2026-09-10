## Why

当前置顶上限固定为 100，主列表序号把置顶也计入普通历史，用户难以保持紧凑的常用区和稳定的普通历史编号。需要可配置的较小上限、明确的超限反馈，以及桌面与 CLI 一致的限制规则。

## What Changes

- 在现有 `AppSettings` 增加 `maxPinnedItems`（Rust `max_pinned_items: usize`），默认 10，范围 5..=20；历史设置页提供立即保存的数字控件。
- **BREAKING（新增置顶行为）**：以配置上限替代固定 100 的新增置顶限制。升级或降低上限保留已有置顶、排序与资源；数量达到或超过上限时只拒绝新增，允许取消置顶和幂等 pin。
- 桌面和 CLI 共用带 `current`、`max` 的类型化限制错误；复用 `pinnedHistoryLimitReached` IPC code，所有置顶入口显示一致的本地化 Toast，不再遗失 Promise 错误。
- 主列表置顶行的序号位置显示低对比但可辨认的 Pin 图标；普通项从 1 独立编号，保留分隔线和详情中的置顶操作。新增无修饰数字键 1–9、0（第 10 项）选择主列表普通历史，仅在非文本编辑、非输入法组合、非弹窗或分组键盘模式时触发。
- 保留实际命令 `mclip-cli pin --id/--index` 和原有 CLI 全列表索引；pin/unpin 读取对应设置。增加 `list --json --with-meta` 返回 `{ meta: { pinnedCount, maxPinnedItems }, data }`；原 `list --json` 数组以及条目的 camelCase、类型联合、敏感遮罩契约不变。
- 补充限制、迁移、幂等操作、快捷键、多窗口反馈和 CLI JSON 兼容测试，并在实施后同步产品与公开 CLI 文档。

## Capabilities

### New Capabilities

- `pin-limit-settings`: 配置范围、即时保存、共享限制校验、非破坏迁移与桌面超限反馈。
- `cli-pin-limit-metadata`: CLI 配置解析、限制错误、幂等操作与可选 JSON 元数据。

### Modified Capabilities

- `history-display`: 新增主列表置顶标识、普通项独立编号与数字快捷选择要求，沿用已实现的置顶分区、普通历史分组和键盘遍历。

## Impact

- Rust：`settings.rs`、`history.rs`、`desktop_state.rs`、`agent_cli.rs`；前端：共享 types/defaults/normalize、Preferences 历史页及搜索索引、history utilities、主列表键盘逻辑、所有置顶入口和 IPC 错误解析。
- 沿用当前 Cargo 包和 React/Tauri 应用，不创建 Gemini 草案中的 `mclip-core`、`mclip-desktop` 新模块，不新增配置文件或独立 `PinSettings` 层。图标复用 `UiIcons.PinIcon`；Toast 实施前优先评估维护活跃的现有库（如 Sonner），验证 React 19 和不可聚焦窗口适配。
- 相关 change：`add-pinned-history-items`（原 100 条上限、无行内图标）、`optimize-preferences-settings-center`、`refine-v0-2-0-interface`、`add-sensitive-content-protection` 和 `prepare-v0-2-0-release`。本 change 覆盖冲突行为；design 记录后续规格同步顺序，不改旧 change 的完成状态。
- 非目标：重构跨进程存储并发、调整普通历史保留策略、增加列表内 Pin 按钮、修改 CLI 默认 JSON 结构/Agent schema、跨设备同步、新窗口、发布或版本变更。
- 本次为提案产物；功能尚待实施。自动化、mock 浏览器、macOS/Windows 原生 smoke、Linux 预览会话验证分别记录，提案校验不代表功能验收或发布。
