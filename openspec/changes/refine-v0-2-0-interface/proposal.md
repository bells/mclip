## Why

v0.2.0 已加入置顶、隐私保护、文本转换、设置中心与 Agent CLI，但用户寻找设置和扫描详情操作时仍要跨分类判断。第一轮界面优化应补齐托盘入口、提高记事本 m 的可辨识度、统一设置归属，并让转换与复制/替换的操作层级更清楚，保留紧凑桌面工具的使用节奏。

## What Changes

- 原生托盘右键菜单增加“偏好设置…”，位于分隔线和“退出 mclip”之前；两项均跟随中英日语言设置，复用既有 Preferences 按需创建与聚焦流程。
- 保留记事本加小写 m 设计，在原画布内适度扩大有效轮廓，统一生成运行时和设置预览资源；不把更大的 PNG 文件误当作原生显示尺寸变大。
- 设置侧栏分组 `MCLIP` 改为“通用”，原 General 页面显示为“行为”，保留内部 destination ID。语言、主题、图标、Logo、序号集中到外观；主窗口/分组展示数量与保存内容、普通历史保留上限集中到历史。同步搜索路径、焦点目标、三语说明。
- 文本详情的转换改为按 JSON、Base64、URL 组件分行的紧凑工具区；保留现有适用性过滤，一次点击进入独立结果窗口。补齐发现操作的加载、失败重试和空状态，明确遮罩内容须先显示后转换。
- 修复结果窗口未占满固定高度、下部透明的布局问题；以“复制结果”为主操作，“替换历史…”为次要且需确认的操作，补操作互斥与过期响应保护。结果内容优先，长文本不挤走窗口控制。
- 对七个窗口及设置六页做有边界的视觉一致性改进：修复CLI正常状态误用危险色、敏感徽标未定义token/过小字，精简隐私与权限说明中的工程术语，检查按钮焦点、置顶状态和长文案溢出。详见 `ui-review.md`，只将本轮明确条目纳入任务，其余作为后续建议。

## Capabilities

### New Capabilities

- `tray-preferences-access`: 本地化原生托盘菜单、Preferences 入口及失败/复用行为。
- `preferences-interface-organization`: 用户可理解的设置分组、外观归属与搜索导航契约。
- `text-transform-presentation`: 按类型组织的转换入口、渐进反馈与结果操作层级。

### Modified Capabilities

- `appearance-settings`: 新增记事本 m 有效尺寸和跨窗口视觉状态的要求，保留既有主题和 Template Image 行为。

## Impact

- Rust：`src-tauri/src/lib.rs` 的 tray/menu、语言更新；复用 `window.rs` 的 `show_preferences_window`，必要时抽取共享关闭 preview/聚焦协调。图标源为 `src-tauri/icons/menu-bar-icon-m.svg`，导出沿用 `scripts/generate-menu-bar-m-icon.mjs`。
- React：PreferencesWindow、preferencesNavigation、PreferencesSettingsCenter、TextQuickActions、QuickActionWindow、HistoryDetailPanel、相关共享状态/样式、三语词典。颜色以 `styles.css`/`uiStyles.ts` 为真相。
- 不改变 settings/history schema、IPC 数据格式、转换算法、CLI 管道行为、历史保留语义、隐私检测范围或权限范围；不新增 UI 框架、动画依赖、窗口或远程请求。
- 基于已经实现但尚未全部归档/验收的 `optimize-preferences-settings-center`、`refine-menu-bar-notebook-m-icon`、`add-text-quick-actions-and-pipelines`，并覆盖 `add-pinned-history-items`、`add-sensitive-content-protection`、`select-ignored-source-apps`、`add-cli-version-and-update-management`、`add-linux-desktop-support` 的界面回归。新设置归属有意取代旧设置中心的对应归类，规格同步顺序与冲突处理见 design。
- 本 change 是提案，任务均待执行。源码版本仍为 0.1.1；本轮不升级版本、不提交发布、不归档其它 change，也不替代 `prepare-v0-2-0-release` 的原生与发布门禁。
- macOS、Windows、Linux 的原生菜单、DPI、窗口焦点/hover 和 compositor 行为分别记录；浏览器合成数据截图、自动化和编译不能替代原生验收。
