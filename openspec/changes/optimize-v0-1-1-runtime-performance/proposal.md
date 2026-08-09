## Why

v0.1.1 已从最初的五窗口工具演进为包含 `image-viewer` 的六窗口应用，但当前六个 WebView 都在进程启动时创建并加载同一个前端入口，生产构建也仍是约 326.7 kB 的单个 JavaScript 包；同时历史读取、全量历史事件和图片 base64 读取在高频路径上存在重复工作。现在需要以真实代码和可重复基线为依据，系统优化应用冷启动、驻留后打开主界面、显示历史详情以及图片详情最大化的速度，而不是继续叠加无法量化的局部微调。

## What Changes

- 建立不包含剪贴板内容的端到端性能里程碑和可重复基线，覆盖冷/热启动、空历史与大量混合历史、首次/重复打开主窗口、文本/文件/图片详情，以及图片查看器首次/重复最大化。
- 为关键路径设定相对基线和交互延迟预算；优化必须用同一设备、同一数据集的前后对比证明收益，并阻止包体、启动和高频交互出现不可解释的回退。
- 按 Tauri 窗口职责拆分前端加载边界，使每个窗口只解析和执行自身需要的 React、TypeScript 与样式路径，低频窗口代码和大图标资源不进入主窗口关键加载路径。
- 调整六窗口生命周期：主窗口和托盘保持可靠的启动关键路径，preview 家族在不牺牲首次详情响应的前提下预热或按需就绪，About、Preferences 与 `image-viewer` 延后到实际需要时创建；新增明确的 ready/timeout/fallback 协议，避免事件在动态窗口监听器挂载前丢失。
- 收敛 Rust 桌面端历史与设置访问，避免同一状态被重复同步读盘、重复解析和无差别广播；保留 CLI 的 path-based helper、原子写入、损坏历史回退、图片资源清理和 Rust/TS camelCase 契约。
- 让历史更新按真正需要的窗口和最小必要 payload 传播，保持主窗口、preview reconciliation、删除、清空和剪贴板监听的一致性，同时降低隐藏窗口的序列化与 React 更新成本。
- 对图片读取采用有界、可失效的复用策略，合并同一路径的并发请求并避免 preview、详情和最大化查看器重复读盘/base64 编码；不得把图片字节放入跨窗口事件，也不得无界缓存本地剪贴板内容。
- 将新安装的最大历史条数默认值调整为 200，并把用户可配置上限从 200 扩展到 500；Rust 与 TypeScript 使用对称边界，已有合法设置值保持不变。
- 审计 React hooks、Rust window/history 模块和 Tailwind/CSS 的职责与渲染成本；只实施有测量证据的结构或样式性能优化，不以文件拆分、重命名或 CSS 重写本身宣称性能提升。
- 保持现有 v0.1.1 与未归档 change 的交互契约：preview 独立且不可聚焦，主窗口仍是搜索/键盘/鼠标导航的唯一所有者，图片查看器仍直接最大化并可恢复，Preferences 仍即时保存，历史格式与剪贴板回填语义不变。

## Capabilities

### New Capabilities

- `runtime-performance`: 定义 mclip 启动、窗口就绪、历史加载、详情显示、图片查看器最大化的测量场景、性能预算、加载边界、状态复用与回退要求。

### Modified Capabilities

- `history-display`: 要求历史刷新和详情展示在减少全量 IPC、重复图片读取和隐藏窗口工作后仍保持一致、及时且不出现旧 preview 重开。

## Impact

- 前端入口与构建：`src/main.tsx`、`src/App.tsx`、窗口级组件加载、`vite.config.ts`、`src/styles.css`、`src/uiStyles.ts`。
- React 状态与 IPC：`useClipboardDataController`、`useHistoryPreviewController`、`useImageDataUrl`、`services/ipc/*`、`services/imageViewer.ts`、共享类型和窗口 ready 协议。
- Rust/Tauri：`src-tauri/tauri.conf.json`、capabilities、`lib.rs` 启动 setup、`window.rs` 窗口工厂/生命周期、`history.rs` 状态仓储、`clipboard.rs` 图片与更新路径、`settings.rs`。
- 测试与验证：新增性能采样/fixture、窗口 ready 与超时测试、bundle/chunk 预算、历史更新与图片请求复用回归；继续执行 `npm run check`、全部 Node tests、Windows target check、严格 OpenSpec 校验和 macOS/Windows 真实交互 smoke。
- 不改变公开历史/设置文件格式，不新增云端或遥测上传，不引入新的运行时依赖，除非实现阶段的基准数据证明现有平台能力无法满足目标并另行评审。
