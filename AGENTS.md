# AGENTS.md

## 项目定位

`mclip` 是一个跨平台剪贴板历史工具，目标平台是 macOS 和 Windows。它是托盘优先的桌面小工具，不是常驻大窗口应用。

技术栈：

- 前端：React 19、TypeScript、Vite
- 桌面壳：Tauri 2
- 后端：Rust
- 打包发布：GitHub Actions + `tauri-apps/tauri-action`

适用 skill：

- `frontend-design`：改主窗口、preview、关于窗口、偏好设置等前端界面时使用。界面应保持桌面工具的紧凑、清晰、可快速扫描，不要做成营销页或装饰性页面。
- `tauri-v2`：改 Tauri 2 配置、窗口、权限、Rust 命令、插件、打包配置或跨平台桌面行为时使用。

## 核心体验

- 托盘或菜单栏常驻，点击托盘图标显示或隐藏主窗口。
- 全局快捷键 `CommandOrControl+Shift+V` 唤起或隐藏主窗口。
- 保存文本、图片、文件路径三类剪贴板历史。
- 去重后最新内容在最前，同一内容重复复制会更新次数和时间。
- 主窗口只显示最新 10 条，更多历史按每 10 条分组。
- 历史分组和单条详情都使用独立透明 preview 窗口，不把预览塞回主窗口 DOM。
- 支持偏好设置：登录时启动、语言、最大历史条数、保存类型。
- 支持 About 独立窗口，展示版本、GitHub 地址和真实应用图标。

## 常用命令

```bash
npm ci
npm run tauri:dev
npm run check
npm run tauri:build
```

`npm run check` 会执行：

- 前端构建：`tsc && vite build`
- Rust 格式检查：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- Rust 单元测试：`cargo test --manifest-path src-tauri/Cargo.toml`
- Rust 编译检查：`cargo check --manifest-path src-tauri/Cargo.toml`
- Rust clippy：`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

提交前优先跑 `npm run check`。如果只改 TSX/CSS 文档化小界面，可以先跑 `npm run build` 快速确认，再跑完整检查。

## 代码地图

```text
src/
  App.tsx                             根据 Tauri window label 分流 main/preview/about/preferences
  App.css                             全局样式、透明窗口裁剪、主窗口和所有弹窗视觉
  constants.ts                        app 名称、GitHub URL、preview 宽度、默认设置
  i18n.ts                             中文和英文文案表
  types.ts                            前后端共享的 camelCase 数据类型
  hooks/useClipboardApp.ts            主窗口状态中心和 preview 联动
  lib/tauri.ts                        前端 Tauri invoke/event 封装
  components/AppHeader.tsx            搜索栏
  components/HistoryList.tsx          最新历史列表
  components/HistoryGroupNav.tsx      历史分组按钮
  components/HistoryPreviewWindow.tsx 独立 preview 容器，按 payload kind 分发
  components/HistoryGroupPreviewWindow.tsx
                                      历史分组 preview 和 hover 详情
  components/HistoryItemPreviewWindow.tsx
                                      单条历史详情 preview
  components/HistoryPreviewDetailWindow.tsx
                                      分组 hover 的独立详情窗口
  components/HistoryDetailPanel.tsx   详情页的三段式外壳
  components/HistoryPreviewDetailContent.tsx
                                      文本/图片/文件详情内容渲染
  components/ImageThumb.tsx           通过 Rust command 读取图片 base64 后渲染
  components/AboutWindow.tsx          关于窗口
  components/PreferencesWindow.tsx    偏好设置窗口
  components/Modal.tsx                主窗口内确认弹窗
  utils/history.ts                    历史过滤、分组、分页纯函数
  utils/preview.ts                    preview 高度和偏移计算
  utils/settings.ts                   前端设置 normalize

src-tauri/
  tauri.conf.json                     Tauri 窗口、CSP、bundle、WebView2、签名配置
  capabilities/default.json           全窗口默认权限
  capabilities/desktop.json           桌面端 positioner 权限
  build.rs                            Tauri build script
  src/main.rs                         发布版 Windows 隐藏控制台，转入 lib.rs
  src/lib.rs                          Tauri 应用入口、托盘、快捷键、命令注册
  src/window.rs                       主窗口和 preview/about/preferences 的尺寸、定位、显示隐藏
  src/clipboard.rs                    剪贴板读写、图片处理、Windows 事件监听、非 Windows 轮询
  src/history.rs                      历史持久化、去重、裁剪、图片资源清理
  src/settings.rs                     设置持久化、登录启动、系统语言默认值
  src/source_app.rs                   macOS/Windows 当前来源应用 best-effort 识别
  src/storage.rs                      原子写文件工具

.github/workflows/
  ci.yml                              macOS 和 Windows 检查
  release.yml                         tag 发布打包，生成 draft release
```

## 前端状态流

主状态集中在 `src/hooks/useClipboardApp.ts`。

主要职责：

- 启动时读取设置和历史。
- 监听后端 `history-updated` 事件刷新列表。
- 监听后端 `settings-updated` 事件刷新语言和偏好设置。
- 根据搜索词计算 `filteredHistory`。
- 计算主窗口显示的前 10 条和历史分组。
- 维护 `previewHistoryGroupIndex`、`previewHistoryItemId`、`previewAnchorTop`。
- 调用 `adjust_window_height` 让 Rust 调整主窗口高度。
- 推送 item/group preview payload 到独立 `preview` 窗口。
- 处理复制、删除、清空历史、打开 About、打开 Preferences、退出应用等操作。

维护注意：

- `searchQueryRef` 用来避免事件回调拿到旧搜索词闭包。
- `previewHistoryGroupIndex`、`previewHistoryItemId` 和 `previewAnchorTop` 必须一起维护。
- 关闭 preview 时要清理延迟关闭 timer。
- 搜索词变化、新剪贴板内容进入、删除条目、打开 About/Preferences 时都要关闭旧 preview。

## 窗口模型

Tauri 配置里当前有五个窗口：

- `main`：主界面，宽度固定 `320`，不可由用户手动 resize。
- `preview`：独立透明预览窗口，用于单条详情和历史分组列表，默认隐藏。
- `preview-detail`：分组 hover 时的独立详情窗口，默认隐藏。
- `about`：关于窗口，固定尺寸，默认隐藏。
- `preferences`：偏好设置窗口，固定尺寸，默认隐藏。

preview 必须保持独立窗口：

- 主窗口不应该为了右侧预览被撑宽。
- 主窗口高度只跟左侧列表、分组行和 footer 有关。
- 分组 preview 初始宽度接近主窗口，只有 hover 到具体条目时才展开详情。
- preview 窗口必须 `set_focusable(false)`，避免它抢焦点后触发 main 失焦隐藏。

关键实现：

- 前端 `HistoryGroupNav` 和 `HistoryList` 用 `getBoundingClientRect().top` 传入 anchor top。
- Rust `show_history_preview_window` 根据 main 窗口位置、anchor、preview 尺寸和屏幕边界定位。
- Rust `show_history_preview_detail_window` 与 `show_history_group_preview_with_detail_window` 负责详情窗口或展开态分组窗口定位。
- `PREVIEW_WINDOW_GAP` 是 `0.0`，保持主窗口和 preview 贴边，避免鼠标穿过空白缝隙导致 hover 断掉。

## Preview 交互

鼠标行为敏感，改动时要小心：

- 从分组按钮移到 preview：preview 不应消失。
- 从分组按钮移到底部菜单：preview 应立即消失。
- 鼠标停在 preview 或 `preview-detail` 内：preview 应保持。
- 鼠标离开 preview 家族窗口：preview 应关闭。

当前做法：

- 前端用跨窗口事件做快速提示。
- Rust 用系统鼠标坐标和 preview 窗口矩形做最终命中判断。
- `is_pointer_over_preview_window` 同时检查 `preview` 和 `preview-detail`。
- `HistoryGroupPreviewWindow` 既有 CSS `:hover`，也用 pointermove 主动追踪。
- `data-preview-item-id` 是 hover 高亮和 `document.elementFromPoint(...)` 追踪的关键，不要移除。

不要把 pointermove 逻辑改成只在 button 上 `onMouseEnter`。透明独立 Tauri 窗口里快速移动时容易丢事件。

## 剪贴板监听

文件：`src-tauri/src/clipboard.rs`

平台策略：

- Windows：使用 Win32 `AddClipboardFormatListener` 和 message-only window 监听 `WM_CLIPBOARDUPDATE`。
- 非 Windows：使用轮询，每 500ms 读取一次剪贴板。

内容策略：

- 按偏好设置里的 `enabledHistoryTypes` 判断保存文本、图片、文件。
- 文件列表优先于图片数据，避免复制文件时被误判。
- 单个常见图片文件会读取并存成图片历史，方便展示缩略图和回填图片。
- 图片会限制最大边长并编码为 PNG，资源保存在 `history-assets/images/`。
- 文本会过滤空白内容。

Windows 监听注意：

- Win32 回调 `window_proc` 只发 channel 信号。
- 实际读取剪贴板放在消息循环里做，避免在回调中阻塞。
- 发布版 `src-tauri/src/main.rs` 使用 `windows_subsystem = "windows"`，不要改回会显示控制台的行为。

## 历史与设置

历史文件：

- 由 `src-tauri/src/history.rs` 管理。
- 存在系统 app config 目录的 `history.json`。
- 新内容先生成稳定 id，再与已有历史合并。
- 超过最大条数会截断。
- 删除和裁剪历史后要清理未使用图片资源。
- Rust 序列化字段必须保持前端需要的 camelCase，例如 `filePaths`、`imagePath`、`byteSize`、`contentHash`。

设置文件：

- 由 `src-tauri/src/settings.rs` 管理。
- 存在系统 app config 目录的 `settings.json`。
- 字段包括 `launchAtLogin`、`language`、`maxHistoryCount`、`enabledHistoryTypes`。
- 前端有 `normalizeSettings`，后端有 `AppSettings::sanitize`，改边界时两边都要同步考虑。

语言规则：

- 首次安装跟随系统语言。
- 系统语言以 `zh` 开头则默认中文。
- 非中文环境默认英文。
- 改文案时必须同时补中文和英文。

登录启动：

- macOS：写 `~/Library/LaunchAgents/<bundle-id>.plist`。
- Windows：写 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\<bundle-id>.cmd`。

写文件：

- 统一通过 `write_text_atomically`。
- 先写临时文件再 rename，降低文件损坏概率。
- Windows rename 覆盖已有文件不稳定，当前会先删除目标文件再 rename。

## 权限、透明窗口与安全

Tauri capability 文件：

- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/desktop.json`

所有现有窗口都必须覆盖：

- `main`
- `preview`
- `preview-detail`
- `about`
- `preferences`

必要权限：

- `core:default`
- `core:window:allow-hide`
- `positioner:default`

如果新增 Tauri API 调用，优先检查 capability 是否需要补权限。新增窗口时也要同步更新两个 capability 文件和 `src/App.tsx` 的窗口 label 分流。

透明与圆角：

- Tauri 窗口启用了 `transparent: true`。
- `main` 根容器 `.app-frame` 使用 `border-radius` + `clip-path`。
- preview 根容器 `.history-preview-window` 使用 `border-radius` + `clip-path`。
- About 和 Preferences 使用 `.app-dialog-frame` / `.app-dialog-panel`。
- macOS 额外用 `raw-window-handle` + AppKit 给 WebView 和 contentView 做圆角裁剪。

## Windows 覆盖点

Windows 功能必须和 macOS 对齐：

- 托盘点击显示/隐藏。
- 全局快捷键 `CommandOrControl+Shift+V`。
- 文本、图片、文件历史。
- 搜索、选择、复制、删除、清空。
- 历史分组 preview、单条详情 preview、分组 hover 详情。
- About 和 Preferences 独立窗口。
- 登录时启动。
- 英文/中文界面和系统语言默认值。

Windows 特有实现：

- 剪贴板监听：`AddClipboardFormatListener`。
- 来源应用识别：`GetForegroundWindow`、`GetWindowThreadProcessId`、`QueryFullProcessImageNameW`。
- 登录启动：Startup 目录 `.cmd`。
- 安装器：`bundle.windows.webviewInstallMode` 使用 `downloadBootstrapper`，缺少 WebView2 时会静默下载运行时。
- 代码签名：当前未配置，用户可能看到 SmartScreen。

无法在 macOS 本地完整替代 Windows 真机验证。改 Windows 专属代码时，至少跑本地 `npm run check`，并确认 GitHub Actions 的 `windows-2022` job 通过。

## GitHub Actions 与发布

CI：

- 文件：`.github/workflows/ci.yml`
- 触发：PR 和 main push
- 平台：`macos-latest`、`windows-2022`
- Node：`actions/setup-node@v6`，Node 24
- Rust：stable + rustfmt
- 命令：`npm run check`

Release：

- 文件：`.github/workflows/release.yml`
- 触发：push `v*` tag
- 使用 `tauri-apps/tauri-action@v0`
- 生成 GitHub Release draft
- macOS 和 Windows 都会打包
- 发布前校验 tag 版本和 `package.json` 版本一致

发版示例：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布注意：

- Tauri 版本配置使用 `src-tauri/tauri.conf.json` 里的 `"version": "../package.json"`，安装包文件名会跟随 `package.json`。
- 发版前先更新 `package.json` 版本，再创建同版本 tag。例如 `package.json` 是 `0.1.0`，tag 必须是 `v0.1.0`。
- `release.yml` 的 Release body 需要同时提示 macOS 未 notarize 和 Windows 未签名。

## macOS 发布

当前不使用 Apple Developer ID，不做 notarization。

配置：

```json
"macOS": {
  "signingIdentity": "-"
}
```

这表示 ad-hoc 签名：

- 可以让 bundle 结构比完全未签名更规整。
- 不能替代 Apple Developer ID。
- 不能消除 Gatekeeper 对 GitHub 下载来源的拦截。

如果用户从 GitHub 下载 DMG 后看到：

> “mclip.app” 已损坏，无法打开

处理方式：

```bash
xattr -dr com.apple.quarantine /Applications/mclip.app
```

前提：

- 用户已将 `mclip.app` 拖到“应用程序”。
- 用户信任该 Release。

未来彻底解决需要：

- 注册 Apple Developer Program。
- 使用 Developer ID Application 证书签名。
- 做 notarization。

## Windows 发布

当前未配置 Windows 代码签名。

结果：

- GitHub Actions 可以生成 Windows 安装包。
- 用户安装时可能看到 SmartScreen 或未知发布者提示。
- 缺少 WebView2 Runtime 时，安装器会用 bootstrapper 静默下载运行时，因此首次安装可能需要联网。

彻底优化需要：

- 代码签名证书，或
- Microsoft Store/MSIX 分发。

## 维护约束

这些约束优先级高，改相关代码时先确认：

- 不要把 preview 重新塞回主窗口 DOM 里，否则主窗口会再次被撑宽。
- 不要移除 Rust 侧 `is_pointer_over_preview_window` 命中判断。
- 不要让 preview 或 `preview-detail` 窗口 focusable。
- 不要把主窗口 `resizable` 改回 `true`。
- 改 preview 尺寸时，同步检查 `src/constants.ts`、`src/utils/preview.ts`、`src-tauri/src/window.rs` 和 Rust 单元测试。
- 改历史条数逻辑时，前端 clamp 和后端 sanitize 都要同步考虑。
- 改保存类型时，同步检查 `HistoryKind`、`HistoryTypes`、`PreferencesWindow`、`clipboard.rs` 和 `history.rs`。
- 改语言文案时，中文和英文都要补齐。
- 改 Tauri 命令或事件名时，要同步更新 `src/lib/tauri.ts` 和 Rust `generate_handler!`。
- 新增窗口时，同步更新 `tauri.conf.json`、两个 capability 文件、`src/App.tsx` 和 AGENTS 代码地图。
- 新增 Tauri API 时，同步检查 `src-tauri/capabilities/default.json`。
- 发布前至少跑 `npm run check`。

## 当前已知限制

- macOS 剪贴板监听仍是轮询。
- macOS 未 notarize，GitHub 下载后可能需要手动解除 quarantine。
- Windows 未签名，可能触发 SmartScreen。
- 当前没有云同步，历史只保存在本机。
