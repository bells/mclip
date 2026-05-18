# AGENTS.md

## 项目概览

`mclip` 是一个跨平台剪贴板历史工具，目标平台是 macOS 和 Windows。

技术栈：

- 前端：React 19、TypeScript、Vite
- 桌面壳：Tauri 2
- 后端：Rust
- 打包发布：GitHub Actions + `tauri-apps/tauri-action`

核心体验：

- 托盘驻留，点击托盘图标显示或隐藏主窗口。
- 全局快捷键 `CommandOrControl+Shift+V` 唤起或隐藏主窗口。
- 保存文本剪贴板历史，去重后最新内容在最前。
- 主窗口只显示最新 10 条，更多历史按每 10 条分组。
- 分组预览使用独立透明 `preview` 窗口贴在主窗口右侧。
- 支持偏好设置：登录时启动、语言、最大历史条数。

## 常用命令

```bash
npm ci
npm run tauri:dev
npm run check
npm run tauri:build
```

`npm run check` 会执行：

- 前端构建：`tsc && vite build`
- Rust 格式检查：`cargo fmt --check`
- Rust 单元测试：`cargo test`
- Rust 编译检查：`cargo check`
- Rust clippy：`cargo clippy --all-targets -- -D warnings`

提交前优先跑 `npm run check`。

## 目录与关键文件

```text
src/
  App.tsx                         主窗口与 preview 窗口的入口分流
  App.css                         全局样式、圆角裁剪、主窗口/preview 视觉
  hooks/useClipboardApp.ts        主窗口状态中心
  lib/tauri.ts                    前端 Tauri invoke/event 封装
  components/HistoryPreviewWindow.tsx
                                  独立 preview 窗口内容
  components/HistoryGroupNav.tsx  历史分组按钮
  components/PreferencesDialog.tsx
                                  偏好设置弹窗
  utils/history.ts                历史过滤、分组、分页纯函数

src-tauri/
  tauri.conf.json                 Tauri 窗口、bundle、macOS 签名配置
  capabilities/default.json       main/preview 窗口权限
  src/lib.rs                      Tauri 应用入口、托盘、快捷键、命令注册
  src/window.rs                   主窗口和 preview 窗口尺寸/定位/显示隐藏
  src/clipboard.rs                剪贴板读写与监听
  src/history.rs                  历史持久化、去重、裁剪
  src/settings.rs                 设置持久化、登录启动、系统语言默认值
  src/storage.rs                  原子写文件工具

.github/workflows/
  ci.yml                          main/PR 检查
  release.yml                     tag 发布打包
```

## 前端状态流

主状态集中在 `src/hooks/useClipboardApp.ts`。

主要职责：

- 启动时读取设置、历史、应用版本。
- 监听后端 `history-updated` 事件刷新列表。
- 根据搜索词计算 `filteredHistory`。
- 计算主窗口显示的前 10 条。
- 计算历史分组与当前 preview 分组条目。
- 调用 `adjust_window_height` 让 Rust 调整主窗口高度。
- 推送 preview 数据到独立 `preview` 窗口。
- 处理复制、清空历史、保存偏好、退出应用等操作。

注意：

- `searchQueryRef` 用来避免事件回调拿到旧搜索词闭包。
- `previewHistoryGroupIndex` 和 `previewAnchorTop` 必须一起维护。
- 关闭 preview 时要清理延迟关闭 timer。

## 主窗口与 preview 窗口

Tauri 配置里有两个窗口：

- `main`：主界面，宽度固定 `320`，不可由用户手动 resize。
- `preview`：独立透明预览窗口，宽度 `304`，不可 resize，默认隐藏。

为什么 preview 是独立窗口：

- 主窗口不应该为了右侧预览被撑宽。
- 主窗口高度应该只跟左侧内容有关。
- preview 可以贴在历史分组按钮右侧，与对应分组行对齐。

关键实现：

- 前端 `HistoryGroupNav` 用 `getBoundingClientRect().top` 传入分组按钮顶部。
- Rust `show_history_preview_window` 根据 main 窗口位置 + anchorTop 定位 preview。
- `PREVIEW_WINDOW_GAP` 是 `0.0`，保持主窗口和 preview 窗口贴边，避免鼠标穿过空白缝隙导致 hover 断掉。
- preview 窗口设置 `set_focusable(false)`，避免它抢焦点后触发 main 窗口失焦隐藏。

鼠标行为比较敏感，改动时要小心：

- 从分组按钮移到 preview：preview 不应消失。
- 从分组按钮移到底部菜单：preview 应立即消失。
- 鼠标停在 preview 内：preview 应保持。
- 鼠标离开 preview：preview 应关闭。

当前做法：

- 前端用跨窗口事件做快速提示。
- Rust 用系统鼠标坐标和 preview 窗口矩形做最终命中判断。
- 不要只依赖 CSS `:hover` 或前端 `mouseenter`，透明独立窗口下这些事件可能不稳定。

## preview 条目高亮

preview 条目既有 CSS `:hover`，也有 `pointermove` 主动追踪。

原因：

- 单纯 `:hover` 在独立透明 Tauri 窗口中可能表现不稳定。
- `HistoryPreviewWindow` 会根据 `data-preview-item-id` 设置 `hoveredItemId`。
- 当前条目叠加 `is-selected` class，样式与主列表选中态一致。

维护时注意：

- 不要移除 `data-preview-item-id`。
- 不要把 pointermove 逻辑改成只在 button 上 `onMouseEnter`，快速移动时容易丢高亮。

## 剪贴板监听

文件：`src-tauri/src/clipboard.rs`

平台策略：

- Windows：使用 Win32 `AddClipboardFormatListener` 和 message-only window 监听 `WM_CLIPBOARDUPDATE`。
- 非 Windows：使用轮询，每 500ms 读取一次剪贴板文本。

非 Windows 轮询不是长期最优，但当前实现比较稳：

- 每次读取都重新创建 `Clipboard`。
- 不长期持有剪贴板句柄。
- 空内容或和上次相同内容会直接忽略。

Windows 监听注意：

- Win32 回调 `window_proc` 只发 channel 信号。
- 实际读取剪贴板放在消息循环里做，避免回调内阻塞。

## 历史与设置

历史文件：

- 由 `src-tauri/src/history.rs` 管理。
- 存在系统 app config 目录的 `history.json`。
- 新文本先去重，再插入队首。
- 超过最大条数会截断。

设置文件：

- 由 `src-tauri/src/settings.rs` 管理。
- 存在系统 app config 目录的 `settings.json`。
- 字段包括：
  - `launchAtLogin`
  - `language`
  - `maxHistoryCount`

语言规则：

- 首次安装跟随系统语言。
- 系统语言以 `zh` 开头则默认中文。
- 非中文环境默认英文。

登录启动：

- macOS：写 `~/Library/LaunchAgents/<bundle-id>.plist`
- Windows：写 Startup 目录下的 `.cmd` 脚本

写文件：

- 统一通过 `write_text_atomically`。
- 先写临时文件再 rename，降低文件损坏概率。

## 权限能力

文件：`src-tauri/capabilities/default.json`

当前 capability 覆盖：

- `main`
- `preview`

必要权限：

- `core:default`
- `core:window:allow-hide`
- `positioner:default`

如果新增 Tauri API 调用，优先检查 capability 是否需要补权限。

## 窗口圆角与透明

Tauri 窗口启用了 `transparent: true`。

CSS 里额外做了根容器裁剪：

- `main` 根容器 `.app-frame` 使用 `border-radius` + `clip-path`
- `preview` 根容器 `.history-preview-window` 使用 `border-radius` + `clip-path`

原因：

- 只给内部面板 `border-radius`，在某些平台/WebView 下仍可能露出直角背景。
- 根容器裁剪更稳。

## GitHub Actions

CI：

- 文件：`.github/workflows/ci.yml`
- 触发：PR 和 main push
- 平台：`macos-latest`、`windows-2022`
- action 使用：
  - `actions/checkout@v6`
  - `actions/setup-node@v6`

Release：

- 文件：`.github/workflows/release.yml`
- 触发：push `v*` tag
- 使用 `tauri-apps/tauri-action@v0`
- 生成 GitHub Release draft
- macOS 和 Windows 都会打包

示例：

```bash
git tag v0.1.3
git push origin v0.1.3
```

注意：

- `windows-latest` 已改为 `windows-2022`，避免 GitHub runner 重定向 notice。
- `checkout/setup-node` 已升级到原生 Node 24 action，避免 Node 20 deprecated warning。

## macOS 发布与 Gatekeeper

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

如果未来想彻底解决：

- 注册 Apple Developer Program。
- 使用 Developer ID Application 证书签名。
- 做 notarization。

## Windows 发布与 SmartScreen

当前未配置 Windows 代码签名。

结果：

- GitHub Actions 可以生成 Windows 安装包。
- 用户安装时可能看到 SmartScreen 或未知发布者提示。

彻底优化需要：

- 代码签名证书，或
- Microsoft Store/MSIX 分发。

## 重要维护约束

- 不要把 preview 重新塞回主窗口 DOM 里，否则主窗口会再次被撑宽。
- 不要移除 Rust 侧 `is_pointer_over_preview_window` 命中判断。
- 不要让 preview 窗口 focusable。
- 不要把主窗口 `resizable` 改回 `true`，用户不应手动调整高度。
- 改历史条数逻辑时，前端 clamp 和后端 sanitize 都要同步考虑。
- 改语言文案时，中文和英文都要补齐。
- 改 Tauri 命令或事件名时，要同步更新 `src/lib/tauri.ts` 和 Rust `generate_handler!`。
- 发布前至少跑 `npm run check`。

## 当前已知限制

- macOS 剪贴板监听仍是轮询。
- 当前只支持文本剪贴板历史。
- macOS 未 notarize，GitHub 下载后可能需要手动解除 quarantine。
- Windows 未签名，可能触发 SmartScreen。
