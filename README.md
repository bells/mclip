# mclip

`mclip` is a lightweight clipboard history app for macOS and Windows, built with Tauri 2, React 19, TypeScript, and Rust.

[中文](#中文) | [English](#english)

## 中文

### 项目简介

`mclip` 是一个常驻托盘的剪贴板历史工具。它专注于桌面日常复制场景：快速唤起、搜索、回填历史内容，并在不打断当前工作的前提下查看更早的记录。

当前版本：`0.1.0`

### 主要功能

- 托盘常驻，点击托盘图标显示或隐藏主窗口。
- 全局快捷键 `CommandOrControl+Shift+V` 唤起或隐藏主窗口。
- 支持文本、图片、文件三类剪贴板历史；文件历史可回填为系统文件列表，方便继续粘贴文件本身。
- 历史记录本地保存，重复内容会合并并移动到最前。
- 主窗口默认展示最新 10 条，更多记录默认按每 10 条分组；两个展示条数都可在偏好设置中调整。
- 历史分组使用独立透明 preview 窗口，不会撑宽主窗口。
- 支持单条历史详情、分组 hover 详情、图片缩略图、颜色代码 swatch、常用表情放大展示和文件详情。
- 文件列表会对过长文件名做中间省略并保留扩展名；文件详情会显示完整绝对路径和完整文件名。
- 支持搜索、方向键选择、回车复制、`Esc` 收起窗口。
- 支持偏好设置：登录时启动、界面语言、外观主题、菜单栏图标样式、自动粘贴、最大历史条数、主界面/历史分组展示条数、复制项序号显示和保存类型。
- 关于窗口支持手动检查 GitHub Releases 上的新版本。
- 支持中英文界面，首次启动会根据系统语言选择中文或英文。

### 安装使用

从 GitHub Releases 下载对应系统的安装包：

- macOS：下载 `.dmg`，把 `mclip.app` 拖到“应用程序”后打开。
- Windows：下载 `.msi` 或 `.exe` 安装包，按安装向导完成安装。

安装后，`mclip` 会在系统托盘或菜单栏运行。可以点击托盘图标，也可以使用 `CommandOrControl+Shift+V` 打开主窗口。

macOS 上，系统支持时可以按住 `Command` 拖动菜单栏里的 mclip 图标到更靠右的位置；mclip 会使用系统位置保存机制，后续启动时尽量恢复该位置。Windows 托盘排序由系统和用户设置控制，应用本身不能强制固定到最右侧。

### macOS 自动粘贴权限

自动粘贴会向系统发送 `Command+V`，macOS 会把它归到“辅助功能”权限。通过 GitHub Release 安装到“应用程序”的 `mclip.app`，和 `npm run tauri:dev` 启动的开发版是两个不同的授权对象；开发版可用不代表安装版已经被授权。

如果自动粘贴没有反应，请打开 mclip 的“偏好设置 > 通用”，点击“打开辅助功能设置”，然后在“系统设置 > 隐私与安全性 > 辅助功能”中允许 `mclip.app`。

### AI Agent 与 CLI

CLI 提供本地历史访问、Agent 模式和受控操作能力，方便 Codex、Claude Code、Cursor、Cline 等工具通过命令读取最近剪贴板上下文，或把重要输出写入 mclip 历史。开发环境中可以这样调用：

```bash
npm run cli -- agent --last 5 --json
npm run cli -- --version
npm run cli -- list --limit 5 --json
npm run cli -- get --index 1 --raw
npm run cli -- search "panic" --json
npm run cli -- context --last 3 --format markdown
npm run cli -- add "note from agent"
npm run cli -- copy --index 1
npm run cli -- delete --id h_xxx
npm run cli -- clear --yes
```

CLI 默认读取本机 mclip 配置目录中的 `history.json`。排查或测试时可以显式指定路径：

```bash
npm run cli -- --history-path /path/to/history.json list --json
```

偏好设置的“通用”页会显示 `mclip-cli` 是否已安装，并提供一键安装按钮。默认安装到用户目录下的 `~/.local/bin/mclip-cli`，不会使用 `sudo` 写系统目录。

也可以直接从命令行安装：

```bash
curl -fsSL https://www.mclip.cn/install.sh | sh
```

当前 CLI 不启动桌面 UI。`--help`/`help` 输出帮助，`--version`、`-V` 和 `version` 输出版本号，且这些信息命令不会读取历史文件。`agent` 会输出一个面向 AI Agent 的聚合包，包含最近历史、可用命令能力表和安全边界，默认 Markdown，也支持 `--json`；`list/get/search/context` 只读取历史并输出 text、JSON、raw 或 Markdown；`add` 会把文本写入历史但不覆盖当前系统剪贴板；`copy` 会把指定历史项写回系统剪贴板；`delete` 和 `clear --yes` 会修改本地 `history.json`。公开安装脚本会优先下载 GitHub Release 里的预构建 `mclip-cli`，只有预构建不可用时才回退到本地或源码构建，此时才需要 Rust/Cargo 和 Git。

### Windows 注意事项

Windows 安装包当前未配置代码签名，所以 Windows SmartScreen 可能提示“未知发布者”。如果你信任该 Release，可以在提示里选择继续安装。

Windows 版本使用 WebView2 运行界面。安装器会在需要时通过 WebView2 bootstrapper 静默安装或更新运行时，因此首次安装可能需要联网。

### macOS 首次打开提示“已损坏”

当前 macOS 包使用 ad-hoc 签名，没有 Apple Developer ID 公证。通过浏览器下载的应用可能会被 macOS 标记为隔离文件，并提示：

> “mclip.app” 已损坏，无法打开

如果你信任该 Release，先把 `mclip.app` 拖到“应用程序”，再执行：

```bash
xattr -dr com.apple.quarantine /Applications/mclip.app
```

然后重新打开 `mclip`。

### 数据与隐私

`mclip` 的历史和设置只保存在本机系统配置目录中：

- `history.json`：剪贴板历史。
- `settings.json`：偏好设置。
- `history-assets/images/`：图片历史生成的 PNG 资源。

应用本身不会上传剪贴板内容。只有在你手动点击“检查更新”时，应用会请求 GitHub Releases 的最新版本信息。Windows 安装器仅在缺少 WebView2 运行时时可能联网下载运行时组件。

### 本地开发

环境要求：

- Node.js 24 或兼容版本
- Rust stable
- macOS：Xcode Command Line Tools
- Windows：Visual Studio Build Tools 和 WebView2 Runtime

常用命令：

```bash
npm ci
npm run tauri:dev
npm run check
npm run tauri:build
npm run cli -- list --limit 5 --json
npm run cli:test
npm run cli:build
npm run cli:install
npm run site:dev
npm run site:build
```

`npm run check` 会执行前端构建、Rust 格式检查、Rust 单元测试、Rust 编译检查和 clippy。

官网位于 `site/`，使用 Astro 生成静态页面。`npm run site:dev` 用于本地预览官网，`npm run site:build` 会输出到 `site/dist/`。

Vercel 部署时，根路径 `/` 由 `site/vercel.json` 在边缘层重定向到 `/en/`，默认进入英文官网，避免先渲染临时中转页面再跳转。

### 发布

Release 由 GitHub Actions 触发：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布前必须保证 tag 版本和 `package.json` 版本一致，例如 `package.json` 为 `0.1.0` 时 tag 必须是 `v0.1.0`。

### 当前限制

- macOS 剪贴板监听仍使用轮询，但只轮询 `NSPasteboard.changeCount`，检测到变化后才读取完整剪贴板内容。
- macOS 未做 Developer ID 签名和 notarization。
- Windows 未做代码签名，可能触发 SmartScreen。
- 当前没有云同步，历史只保存在本机。

## English

### Overview

`mclip` is a tray-first clipboard history app for everyday desktop copying. It is designed to open quickly, stay compact, search local history, and restore previous clipboard items without taking over the screen.

Current version: `0.1.0`

### Features

- Runs from the tray or menu bar.
- Toggle the main window with `CommandOrControl+Shift+V`.
- Saves text, image, and file clipboard history. File history is restored as a system file list, so files can be pasted again as files.
- Keeps history locally, deduplicates repeated content, and moves reused items to the top.
- Shows the latest 10 items in the main window by default, with older items grouped by 10 by default; both display counts are configurable in Preferences.
- Uses a separate transparent preview window for grouped history, so the main window stays compact.
- Supports item details, grouped hover details, image thumbnails, color-code swatches, common emoji display, and file details.
- Long file names are middle-ellipsized in lists to preserve extensions, while file details show the full absolute path and full file name.
- Supports search, arrow-key selection, Enter-to-copy, and Escape-to-hide.
- Preferences include launch at login, display language, appearance theme, menu bar icon style, auto paste, maximum history count, main/group display counts, row number visibility, and enabled content types.
- The About window can manually check GitHub Releases for a newer version.
- Supports Chinese and English UI. The first launch follows the system language when possible.

### Installation

Download the installer for your platform from GitHub Releases:

- macOS: download the `.dmg`, then drag `mclip.app` into Applications.
- Windows: download the `.msi` or `.exe` installer and follow the setup wizard.

After installation, `mclip` runs in the system tray or menu bar. Click the tray icon or press `CommandOrControl+Shift+V` to open the main window.

On macOS, when the system allows it, hold `Command` and drag the mclip menu bar icon closer to the right side; mclip uses the system status-item position restore mechanism on later launches. On Windows, tray ordering is controlled by the system and user settings, so the app cannot force a rightmost position.

### macOS Auto Paste Permission

Auto Paste sends `Command+V` through the system, so macOS protects it with Accessibility permission. The `mclip.app` installed from a GitHub Release and the dev app launched by `npm run tauri:dev` are authorized separately; a working dev build does not mean the installed app is already trusted.

If Auto Paste does not react, open `Preferences > General` in mclip, click `Open Accessibility`, then allow `mclip.app` in `System Settings > Privacy & Security > Accessibility`.

### AI Agent And CLI

The CLI provides local history access, Agent Mode, and controlled actions so tools such as Codex, Claude Code, Cursor, and Cline can read recent clipboard context or write important output back into mclip history. In development, run:

```bash
npm run cli -- agent --last 5 --json
npm run cli -- --version
npm run cli -- list --limit 5 --json
npm run cli -- get --index 1 --raw
npm run cli -- search "panic" --json
npm run cli -- context --last 3 --format markdown
npm run cli -- add "note from agent"
npm run cli -- copy --index 1
npm run cli -- delete --id h_xxx
npm run cli -- clear --yes
```

By default, the CLI reads `history.json` from the local mclip app configuration directory. For troubleshooting or tests, pass an explicit path:

```bash
npm run cli -- --history-path /path/to/history.json list --json
```

The General tab in Preferences shows whether `mclip-cli` is installed and provides a one-click install button. It installs to the user directory at `~/.local/bin/mclip-cli` by default and does not use `sudo` to write system directories.

You can also install directly from the terminal:

```bash
curl -fsSL https://www.mclip.cn/install.sh | sh
```

The current CLI does not start the desktop UI. `--help`/`help` prints help, and `--version`, `-V`, and `version` print the version without reading the history file. `agent` emits an AI-agent-ready bundle with recent history, command capabilities, and safety boundaries; it defaults to Markdown and supports `--json`. `list/get/search/context` only read history and emit text, JSON, raw, or Markdown output; `add` writes text into history without replacing the current system clipboard; `copy` writes a selected history item back to the system clipboard; `delete` and `clear --yes` modify the local `history.json`. The public install script prefers prebuilt `mclip-cli` binaries from GitHub Releases and falls back to local/source builds only when a prebuilt binary is unavailable, so Rust/Cargo and Git are no longer required for the normal path.

### Windows Notes

The Windows installer is currently unsigned, so Windows SmartScreen may warn about an unknown publisher. Continue only if you trust the release.

The Windows app uses WebView2 for its UI. The installer is configured to run the WebView2 bootstrapper silently when the runtime is missing or needs an update, so first-time installation may require an internet connection.

### macOS “App Is Damaged” Warning

The macOS build currently uses ad-hoc signing and is not notarized with an Apple Developer ID. Apps downloaded from a browser may be quarantined by macOS and shown as damaged.

If you trust the release, drag `mclip.app` into Applications, then run:

```bash
xattr -dr com.apple.quarantine /Applications/mclip.app
```

Open `mclip` again after removing the quarantine attribute.

### Data And Privacy

`mclip` stores history and settings only in the local app configuration directory:

- `history.json`: clipboard history.
- `settings.json`: preferences.
- `history-assets/images/`: PNG assets generated for image history.

The app does not upload clipboard contents. It requests the latest GitHub Releases version only when you manually click “Check for Updates”. On Windows, the installer may access the network only to download WebView2 when the runtime is missing.

### Development

Requirements:

- Node.js 24 or compatible
- Rust stable
- macOS: Xcode Command Line Tools
- Windows: Visual Studio Build Tools and WebView2 Runtime

Common commands:

```bash
npm ci
npm run tauri:dev
npm run check
npm run tauri:build
npm run cli -- list --limit 5 --json
npm run cli:test
npm run cli:build
npm run cli:install
npm run site:dev
npm run site:build
```

`npm run check` runs the frontend build, Rust formatting check, Rust tests, Rust compile check, and clippy.

The product site lives in `site/` and uses Astro to generate static pages. Use `npm run site:dev` to preview it locally and `npm run site:build` to write `site/dist/`.

On Vercel, the root path `/` is redirected to `/en/` by `site/vercel.json` at the edge layer, making the English site the default and avoiding a temporary redirect page flash.

### Release

GitHub Actions publishes release drafts from version tags:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag version must match `package.json`. For example, package version `0.1.0` must be released with tag `v0.1.0`.

### Known Limitations

- macOS clipboard watching still uses polling, but it only polls `NSPasteboard.changeCount` and reads full clipboard contents after a detected change.
- macOS builds are not Developer ID signed or notarized.
- Windows builds are unsigned and may trigger SmartScreen.
- There is no cloud sync. History stays on the local machine.
