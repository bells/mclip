## Why

图片历史详情目前只能在尺寸受限的 preview 窗口中查看，较大截图和高分辨率图片难以辨认细节。需要从现有详情头部快速进入专用的全屏查看模式，同时不改变文本、文件详情和历史 preview 的既有交互。

## What Changes

- 仅在图片历史详情的删除按钮旁增加一个对角展开图标按钮，并提供中英文无障碍名称与提示。
- 从单条详情 preview 或历史分组 hover 详情打开专用的全屏图片查看器，按原始宽高比完整展示图片。
- 全屏查看器提供明确的关闭按钮与 `Escape` 键退出路径，并在加载中、加载失败时给出可理解的状态反馈。
- 打开全屏查看器时收起临时 preview 窗口；退出后回到主历史窗口，不自动恢复可能已失效的 hover 详情。
- 保持现有 `preview` 与 `preview-detail` 窗口不可聚焦；全屏查看器使用独立、可聚焦的 Tauri 窗口承载键盘退出交互。

## Capabilities

### New Capabilities

- `image-fullscreen-viewer`: 定义图片历史详情的全屏入口、专用查看窗口、图片适配、状态反馈与退出行为。

### Modified Capabilities

无。

## Impact

- 前端：图片详情头部操作、共享详情组件、新的全屏图片查看器组件、窗口 label 分流、图片加载状态和中英文文案。
- Tauri：新增 `image-viewer` 窗口及其 capability 覆盖，并增加用于打开、聚焦、全屏显示和关闭查看器的 typed command/event 边界。
- Preview 生命周期：打开查看器时需要关闭 `preview` 与 `preview-detail`，并避免旧的 hover 或异步请求重新显示详情。
- 测试：补充图片专属入口、键盘退出、加载失败、窗口配置与 preview 清理的前端及 Rust 回归覆盖。
- 依赖：不引入新的运行时依赖，沿用项目现有主题 token、图片读取命令和图标体系。
