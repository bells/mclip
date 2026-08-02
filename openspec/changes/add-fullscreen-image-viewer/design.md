## Context

图片详情目前由 `HistoryDetailPanel` 统一组织头部、内容和元数据；单条详情由 `HistoryItemPreviewWindow` 承载，历史分组中的 hover 详情由独立的 `HistoryPreviewDetailWindow` 承载。两类 preview 必须继续保持独立外壳、不可聚焦和基于鼠标命中的关闭逻辑，不能直接把现有 preview 拉伸成全屏窗口。

图片数据由 Rust 的 `get_image_base64` 命令读取，再在 React 中转换为 `data:` URL。现有 `ImageThumb` 只处理缩略图成功态，加载中和失败时返回空内容，不适合直接承担沉浸式查看器。主窗口本身为 always-on-top 托盘窗口，因此打开全屏查看器时还需要显式管理主窗口与 preview 家族的可见性。

本次属于现有产品界面的局部演进。视觉上保持当前 Tailwind v4 语义 token、圆角和图标语言，采用 `DESIGN_VARIANCE 3 / MOTION_INTENSITY 3 / VISUAL_DENSITY 7`：全屏层使用单一深色中性背景、克制的淡入反馈和紧凑控制，不引入营销页式装饰或新设计系统。

## Goals / Non-Goals

**Goals:**

- 在图片类型的两种历史详情外壳中提供一致、紧邻删除按钮的全屏入口。
- 使用专用、可聚焦的 Tauri 窗口进行真正的跨平台全屏展示，同时保留现有 preview 的不可聚焦约束。
- 保持图片完整可见、原始宽高比不变，并为加载、失败、关闭和键盘退出提供明确反馈。
- 打开和关闭查看器时以确定的顺序清理 preview 状态，避免 hover 或异步请求重新弹出旧详情。
- 保持 Rust 系统窗口职责、typed IPC 封装与 React 渲染职责的边界清晰。

**Non-Goals:**

- 不提供缩放、拖拽、旋转、幻灯片、编辑、另存为或删除操作。
- 不为文本或文件历史增加全屏入口。
- 不改变图片历史的存储格式、压缩方式、去重逻辑或剪贴板回填行为。
- 不重构主窗口、历史分组布局或既有 preview 的定位算法。
- 不迁移全项目图标或引入新的前端运行时依赖。

## Decisions

### 1. 新增专用的 `image-viewer` 窗口

在 `tauri.conf.json` 预声明一个默认隐藏、无系统装饰、不可手动 resize、可聚焦的 `image-viewer` 窗口。打开时由 Rust 读取主窗口所在显示器的完整物理 position/size，运行时再次确保窗口可聚焦、关闭 decorations 与 shadow，并在显示前和进入 simple fullscreen 后各应用一次显示器 frame；关闭时退出 simple fullscreen 并隐藏。双重 frame 应用避免 macOS 仅切换窗口样式却保留旧 800×600 frame。macOS 的 simple fullscreen 负责隐藏原生标题栏和菜单栏且不创建单独 Space；Windows 等平台由 Tauri 回退到普通 fullscreen。

macOS 上 `show`、frame/fullscreen 更新与窗口 `set_focus` 都经由窗口事件队列执行，而且宿主 `NSWindow` 成为 key window 不代表内部 `WKWebView` 已成为 first responder。查看器在立即聚焦宿主窗口后，还显式聚焦 WebView；打开后的短时间内有限次数地重申这两层焦点。重试只在窗口仍可见时发生并很快结束，避免持续抢回用户主动切换到其它应用的焦点。

选择专用窗口而不是放大 `preview`，因为现有 preview 必须 `set_focusable(false)`，并且受鼠标离开关闭、锚点定位和固定尺寸约束。选择预声明窗口而不是每次动态创建，可以沿用 `App.tsx` 的 window-label 分流、静态 capability 和现有事件监听模式，并减少跨平台窗口创建时序差异。

`image-viewer` 加入两个 capability 文件与 `App.tsx` 分流，但不加入 `configure_main_window` 中将 preview 设为不可聚焦的循环。它使用不透明的深色语义背景，不依赖透明窗口私有 API，也不使用 always-on-top；打开前先隐藏 always-on-top 的主窗口，避免层级冲突。

### 2. 用 typed event 传递展示数据，用 Rust command 控制窗口

新增 `ImageViewerPayload`，仅包含查看器所需的 `imagePath`、替代文本、尺寸、语言与外观主题。前端通过 `services/ipc/events.ts` 向 `image-viewer` 发送 payload，通过 `services/ipc/commands.ts` 调用 `show_image_viewer` / `close_image_viewer`。`src/lib/tauri.ts` 继续作为兼容 facade 导出这些能力。

选择事件传数据、命令管窗口，是为了与现有 preview 通信方式一致，同时让 Rust 继续负责 fullscreen、focus、show/hide 等系统调用。不会让 React 组件直接操作 Tauri window API，也不会把图片 base64 放入跨窗口 payload，以避免复制大字符串和增加事件内存开销。

打开顺序为：发送 payload、使当前 preview 请求失效、解析主窗口所在显示器、由 Rust 隐藏主窗口及 preview 家族、确保查看器可聚焦、强制无装饰、应用完整显示器 frame、显示窗口、设置 simple fullscreen、再次应用显示器 frame，随后依次聚焦宿主窗口与内部 WebView。macOS 再执行短时、有界的双层聚焦重试，以消除首次显示的事件队列竞争。若 simple fullscreen 只更新样式，第二次显式 position/size 仍保证窗口覆盖整块目标显示器。若窗口显示失败，调用方记录错误并保持主窗口可恢复。关闭顺序为：退出 simple fullscreen、隐藏查看器、在原位置重新显示并聚焦主窗口、发送 `main-window-shown` 事件；旧 preview 不自动恢复。

### 3. 从共享详情动作层按类型显示入口

新增共享的图片全屏动作按钮，或将详情头部动作组合提取为小组件，供 `HistoryItemPreviewWindow` 与 `HistoryPreviewDetailWindow` 同时使用。只有 `item.kind === "image"` 时渲染对角展开按钮，视觉顺序为“全屏、删除、类型与序号”。按钮复用现有 `historyDetailActionButton` 的尺寸、圆角与 focus ring，但使用中性 hover 色；删除按钮继续保留危险色反馈。

图标继续放在现有 `UiIcons` 入口并复用统一的 `IconBase`、`currentColor` 与 `1.8` stroke 规则，以一组沿 45° 对角线向右上、左下展开的双向箭头明确表达“放大/全屏”，避免单箭头被误认为外部链接，也避免只为一个按钮混入第二套图标家族。按钮同时提供 `aria-label` 和 `title`，中英文分别表达“全屏查看图片”和 “View image fullscreen”。

### 4. 抽取可复用的图片数据加载状态

从 `ImageThumb` 的读取逻辑抽取 `useImageDataUrl(imagePath)`，返回 `loading | ready | error` 与 data URL。缩略图保持当前安静降级行为；新的 `FullscreenImageViewer` 显式渲染匹配最终图片区域的加载骨架，以及带关闭出口的错误文案。

图片使用 `max-width: 100%`、`max-height: 100%` 和 `object-contain` 居中显示，允许为适应屏幕而缩小或放大，但不得裁剪、拉伸或改变源文件。背景与控制层使用现有明暗主题 token 的专用查看器变体；媒体区域始终保持低干扰的深色中性底，以保证透明或浅色图片边界可辨。

### 5. 关闭交互保持简单且可恢复

查看器不提供原生标题栏或状态栏，只在右上角提供明确的关闭按钮，并在捕获阶段监听 `Escape`。simple fullscreen 不让 macOS 原生 fullscreen 过渡抢占 `Escape`；两种退出路径都调用同一关闭函数，使用前后端进行中 guard 防止重复命令。窗口原生 close request 仍改为隐藏并恢复主窗口，而不是销毁预声明窗口。

不采用“点击图片外区域关闭”，因为查看大图时误触成本高；不加入复杂转场，打开和关闭只允许短时 opacity 反馈，并在 `prefers-reduced-motion` 下立即完成。

### 6. Preview 生命周期在进入全屏前失效

单条 preview 和分组 hover 详情触发全屏时，都先发送既有 selection-started 或等价的 dismissal 信号，使未完成的 update/show 请求失效。Rust 侧隐藏主窗口时复用 `hide_main_window` 清理整个 preview 家族。退出时只恢复主窗口并触发既有 `main-window-shown` reset，不重放详情 payload。

选择回到主窗口而不是恢复原详情，是因为 hover 锚点、搜索结果和历史内容在全屏期间可能已经变化。自动重放会重新引入已经修复过的 preview reopen race。

## Risks / Trade-offs

- [macOS 对隐藏窗口的原生 fullscreen 请求可能不生效，并产生独立 Space 异步过渡] → 使用显示后的 simple fullscreen，直接铺满当前显示器并保留前端 `Escape` 所有权；真机 smoke 覆盖进入、退出和重复打开。
- [Windows 上 always-on-top 主窗口遮挡查看器] → 打开查看器前调用 `hide_main_window`，关闭后再原位恢复主窗口。
- [跨窗口事件在查看器尚未监听时丢失] → `image-viewer` 作为预声明窗口随应用加载；实现时先验证监听就绪，并在需要时增加可读取的最后 payload，而不是依赖定时等待。
- [大图片转换为 base64 带来内存峰值] → 继续复用已有缩放后的 PNG 历史资源，不在事件中传 base64；组件卸载时丢弃 data URL 状态。后续若历史图片上限变化，再评估 asset protocol。
- [全屏按钮与删除按钮过近导致误点] → 使用相同 28px 控件尺寸但保留清晰间距，中性与危险 hover 状态分离，并提供明确 tooltip。
- [退出时旧 hover 请求重开 preview] → 进入前使 request revision 失效，关闭时只触发已定义的主窗口 reset，不恢复详情。

## Migration Plan

1. 先加入 payload 类型、typed IPC/event 和纯状态测试，再新增窗口控制命令及 Rust 测试。
2. 配置并路由隐藏的 `image-viewer` 窗口，更新两个 capability 文件和窗口配置测试。
3. 实现共享图片加载状态、全屏查看器及中英文文案。
4. 将图片专属动作接入两种详情外壳，补齐 preview dismissal 与交互测试。
5. 运行 `npm run check`、Windows target check 和 `git diff --check`，再分别 smoke macOS 进入/退出全屏；Windows 真机行为由 CI 与后续 device smoke 确认。

回滚时删除 `image-viewer` 窗口、命令、事件、组件和入口按钮即可；历史文件、设置文件与图片资源格式均无迁移，旧数据不受影响。

## Open Questions

无。首版采用单图完整适配与显式退出，缩放和拖拽留待独立需求。
