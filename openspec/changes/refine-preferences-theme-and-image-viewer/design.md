## Context

mclip 是固定主窗口加多个独立 Tauri 辅助窗口的托盘工具。偏好设置当前固定为 `760×420`，通用页把语言、外观和菜单栏图标压在三列同一行；英文标签和下拉值让窗口显得横向松散，同时开关、主按钮与危险按钮仍有少量硬编码颜色。双主题的主体文本、边框和元信息对比已经达到可用水平，本次不需要重建配色体系。

图片详情目前复用 `HistoryDetailPanel`、`HistoryPreviewDetailContent` 和 `ImageThumb`，专用 `image-viewer` 则由 `FullscreenImageViewer` 和 Rust 窗口命令承载。`preview` 与 `preview-detail` 必须继续不可聚焦，并保留现有 pointer 命中、hover 详情和请求失效逻辑，因此“直接放大历史详情”在用户视角复用完整详情结构，在实现上仍由可聚焦的 `image-viewer` 原生窗口承载，不能直接最大化 preview 家族窗口。

本次是 v0.1.1 发布前的局部精修，设计读法为“面向高频桌面用户的紧凑工具界面，安静、精确、内容优先”，采用 `DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 8`。现有冷绿浅色底、深色炭黑底、暖金元信息、青绿色交互和红色危险状态是需要保留的产品识别。

## Goals / Non-Goals

**Goals:**

- 在不增加设置字段的前提下，让通用设置和历史设置更容易按任务扫描，并缩小偏好设置窗口的横向占用。
- 通过语义 token 修正浅色选中态、开关激活色、强调按钮和危险按钮的前景对比，同时保持明暗主题的视觉身份一致。
- 让图片详情动作直接打开最大化的专用查看器，完整复用历史详情三段式结构，并在最大化与约 `720×520` 的普通状态之间切换。
- 查看器打开期间保持主窗口可见且位置不变，关闭后只恢复其焦点，不重开旧 preview。
- 让普通图片详情在资源加载中或失败时也有明确、克制的反馈。
- 保持 React 渲染、typed IPC 与 Rust 系统窗口职责的既有边界。

**Non-Goals:**

- 不重做主窗口、字体、阴影、圆角或全局视觉语言。
- 不新增设置项、保存/取消按钮、设置草稿流程或数据迁移。
- 不让 `preview`、`preview-detail` 可聚焦，不修改分组 hover、pointer polling、定位或 dismissal request revision。
- 不增加图片缩放、拖拽、旋转、编辑、另存为、幻灯片或系统最小化。
- 不引入新的前端或 Rust 依赖。

## Decisions

### 1. 偏好设置使用分组后的单列设置行

把偏好设置固定尺寸改为约 `600×480`。通用页按“界面”“启动与行为”“主窗口”分组：语言、外观、菜单栏图标各占一行，启动登录和自动粘贴相邻，Logo 与序号显示相邻。选择控件仍位于行尾，标签和说明位于左侧，继续复用现有 select、自定义菜单栏图标 listbox 和 checkbox 控件。

相比保留三列并继续压缩字号，单列行更适合中英文长度变化，也能把说明文案作为信息层级的一部分。相比改成侧边栏或多级设置导航，三页签结构对当前设置数量仍足够，改动更小。自动粘贴权限说明提升到 11px，但不改变检查、授权和即时保存逻辑。

“存储 / Storage”只改变可见页签名称为“历史 / History”，内部 tab key 可以继续保留 `storage`，避免无价值的状态与测试重命名。历史页按保存类型、最大记录数、主窗口条数、历史分组条数排列，先回答“保存什么”，再回答“保存多少和显示多少”。

### 2. 只修语义色缺口，不替换现有调色板

在 `styles.css` 新增 `--mclip-control-active`、`--mclip-on-control-active`、`--mclip-on-accent-action` 和 `--mclip-on-danger-action` 等语义 token，并由明暗主题分别赋值。开关激活态不再硬编码 `#0a84ff`；强调和危险按钮不再假设统一白色或黑色前景。

浅色 `--mclip-selected-bg` 的渐变两端统一使用青绿色 selection token，移除末端暖棕色。暖金继续只服务索引、元信息和提示，不承担选中状态。深色主题保留当前高对比炭黑层级和低饱和青绿，不做整体增亮或饱和度提升。

相比逐个组件写 raw hex，语义 token 能同时覆盖默认、hover、focus 和 disabled 状态并减少双主题漂移；相比引入完整设计系统，这对 v0.1.1 风险更低。

### 3. `image-viewer` 继续独立，但呈现为同一历史详情的放大状态

保留 `image-viewer` 的预声明、focusable、无系统标题栏和 `skipTaskbar` 特性。约 `720×520` 作为恢复后的普通 frame，允许 resize/maximize、禁止 minimize。Rust 的 `show_image_viewer` 先退出可能残留的最大化状态、设置并居中普通 frame，再显示、原生最大化并聚焦，让用户从历史详情动作一步进入放大状态。

typed `toggle_image_viewer_maximize` command 返回切换后的 `maximized` 状态。React 查看器不再维护另一套工具栏和纯图片画布，而是渲染 `HistoryDetailPanel`；标题栏保留“历史详情”、内容类型与序号、删除和关闭动作，并让同一位置的最大化按钮在放大后显示恢复图标。最大化使用原生 `maximize()`，恢复使用 `unmaximize()`，由原生窗口保存普通 frame。由于窗口不在任务栏，系统最小化后没有可靠的恢复入口，因此不提供最小化。

相比把 `preview` 原生窗口直接放大，这个方案不破坏 preview 的不可聚焦、anchor、hover 和鼠标离开关闭契约；相比独立设计一套 viewer 工具栏，它让用户始终面对同一历史详情结构，恢复后仍是同一详情的普通窗口。

### 4. 图片详情与查看器共享完整结构，不共享窗口生命周期

`ImageViewerPayload` 携带完整图片 `HistoryListItem`、语言和主题，使查看器可以复用 `HistoryDetailPanel` 的标题、内容和来源应用、首次复制、最后复制、复制次数元信息。`HistoryPreviewDetailContent` 增加 viewer 展示模式，只扩大图片与 loading/error 区域，不复制图片读取逻辑；主列表和分组列表继续安静返回空内容，避免行高变化。

这个方式复用了真正稳定的详情能力，并保持 `HistoryPreviewDetailContent` 的职责清晰。viewer 的关闭、键盘和窗口状态仍留在专用 viewer 组件，不会塞进 preview 组件，也不会重构既有图片历史持久化契约。

### 5. 主窗口在图片查看期间保持显示

`show_image_viewer` 不再调用 `hide_main_window`，而是显式隐藏 `preview` 与 `preview-detail`，并在显示 viewer 前把 main 从托盘弹窗的 always-on-top 层级临时降为普通窗口层级。主窗口的 `Focused(false)` 自动隐藏处理在 viewer 可见期间跳过隐藏，因此 viewer 可以获得键盘焦点和 `Escape`，同时主窗口仍保持 visible、位置不变，并自然被最大化详情覆盖。

关闭 viewer 时隐藏并退出最大化，恢复 main 原有的 always-on-top 层级，再聚焦已经可见的主窗口；viewer 打开失败时也执行同样的层级恢复。仍发送既有 `main-window-shown` 重置信号，确保 preview dismissal 生命周期回到可用状态。这个例外只适用于 viewer 可见期间，不改变 About、Preferences、普通桌面点击或 preview hover 的主窗口失焦行为。

### 6. 双语和自动保存保持原有行为

为设置分组、History 页签、查看器最大化/恢复及普通详情加载状态补齐中英文文案。所有设置控件继续调用现有 `applySettingsPatch` 队列，保存期间不锁定整页；外部 `settings-updated` 事件继续避开 pending save，防止闪烁和旧值回写。

## Risks / Trade-offs

- [偏好设置收窄后自动粘贴权限说明可能变高] → 增加窗口高度并让 tab panel 自身滚动，使用 11px 可读说明，不压缩正文。
- [浅色语义色调整影响多个窗口] → 只替换已定义的 selection、active-control、accent-action 和 danger-action token，并用 focused source tests 与对比计算覆盖。
- [最大化状态与 React 按钮标签不同步] → viewer 每次接收 payload 都以“即将直接最大化”为初始状态，所有后续最大化/恢复都走返回状态的 typed command；无系统标题栏，因此没有第二套原生按钮状态源。
- [`skipTaskbar` 窗口不能通过任务栏找回] → 明确禁用 minimize，并始终保留查看器内关闭按钮与 `Escape`。
- [窗口尺寸在高 DPI 或小屏上过大] → 由 Tauri 的逻辑尺寸和当前显示器居中处理；普通窗口可 resize，小屏仍可最大化。
- [普通详情的加载 fallback 导致列表行抖动] → fallback 只用于详情容器，列表与分组缩略图调用不传 fallback。
- [viewer 获得焦点会触发主窗口自动隐藏] → 失焦处理先检查 viewer 可见状态，只在 viewer 不可见且鼠标不在 preview 家族时执行原有隐藏。
- [主窗口保留后旧 preview 仍覆盖在旁边] → 打开 viewer 前显式隐藏 `preview` 和 `preview-detail`，同时保留 selection dismissal 防止旧异步请求重开。
- [main 的 always-on-top 层级会压在普通 viewer 上方] → viewer 显示期间临时降低 main 层级，并在关闭、重复关闭或打开失败路径恢复原有层级。
- [Windows 最大化或恢复细节无法由 macOS 证明] → 本地执行条件编译检查，发布结论保留 Windows CI 与真机 smoke 边界。

## Migration Plan

1. 先更新 OpenSpec delta specs 和聚焦测试，锁定设置分组、语义 token 与 viewer 窗口契约。
2. 调整 Preferences JSX、i18n、Tailwind 映射和 Tauri 固定窗口尺寸，保持即时保存路径不变。
3. 增加图片详情 fallback 与 viewer 最大化/恢复 UI，再补齐 typed IPC 和 Rust 窗口命令。
4. 将 viewer payload 扩展为完整图片历史项，复用 `HistoryDetailPanel`，改为直接最大化并增加主窗口失焦保护。
5. 运行聚焦 Node tests、完整前端/Rust 检查、全部 JS tests、严格 OpenSpec 校验和 diff 检查。
6. 在 macOS 手动确认中英文、light/dark/system、即时保存、viewer 直接最大化/恢复/Escape、删除，以及 viewer 打开期间主窗口不消失；Windows 由 CI 和真机确认。

回滚时恢复 Preferences 与 image-viewer 的窗口尺寸、移除新增 viewer command 和语义 token，并还原对应组件与测试即可。设置文件、历史文件和图片资源没有迁移。

## Open Questions

无。v0.1.1 使用直接最大化、恢复到固定默认尺寸、关闭和删除的最小能力集，缩放工具与系统最小化留给后续独立需求。
