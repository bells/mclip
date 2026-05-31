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
- 支持文本、图片、文件路径三类剪贴板历史。
- 历史记录本地保存，重复内容会合并并移动到最前。
- 主窗口默认展示最新 10 条，更多记录按每 10 条分组。
- 历史分组使用独立透明 preview 窗口，不会撑宽主窗口。
- 支持单条历史详情、分组 hover 详情、图片缩略图和文件路径详情。
- 支持搜索、方向键选择、回车复制、`Esc` 收起窗口。
- 支持偏好设置：登录时启动、界面语言、最大历史条数、保存类型。
- 支持中英文界面，首次启动会根据系统语言选择中文或英文。

### 安装使用

从 GitHub Releases 下载对应系统的安装包：

- macOS：下载 `.dmg`，把 `mclip.app` 拖到“应用程序”后打开。
- Windows：下载 `.msi` 或 `.exe` 安装包，按安装向导完成安装。

安装后，`mclip` 会在系统托盘或菜单栏运行。可以点击托盘图标，也可以使用 `CommandOrControl+Shift+V` 打开主窗口。

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

应用本身不会上传剪贴板内容。Windows 安装器仅在缺少 WebView2 运行时时可能联网下载运行时组件。

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
```

`npm run check` 会执行前端构建、Rust 格式检查、Rust 单元测试、Rust 编译检查和 clippy。

### 发布

Release 由 GitHub Actions 触发：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布前必须保证 tag 版本和 `package.json` 版本一致，例如 `package.json` 为 `0.1.0` 时 tag 必须是 `v0.1.0`。

### 当前限制

- macOS 剪贴板监听仍使用轮询。
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
- Saves text, image, and file-path clipboard history.
- Keeps history locally, deduplicates repeated content, and moves reused items to the top.
- Shows the latest 10 items in the main window, with older items grouped by 10.
- Uses a separate transparent preview window for grouped history, so the main window stays compact.
- Supports item details, grouped hover details, image thumbnails, and file-path details.
- Supports search, arrow-key selection, Enter-to-copy, and Escape-to-hide.
- Preferences include launch at login, display language, maximum history count, and enabled content types.
- Supports Chinese and English UI. The first launch follows the system language when possible.

### Installation

Download the installer for your platform from GitHub Releases:

- macOS: download the `.dmg`, then drag `mclip.app` into Applications.
- Windows: download the `.msi` or `.exe` installer and follow the setup wizard.

After installation, `mclip` runs in the system tray or menu bar. Click the tray icon or press `CommandOrControl+Shift+V` to open the main window.

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

The app does not upload clipboard contents. On Windows, the installer may access the network only to download WebView2 when the runtime is missing.

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
```

`npm run check` runs the frontend build, Rust formatting check, Rust tests, Rust compile check, and clippy.

### Release

GitHub Actions publishes release drafts from version tags:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag version must match `package.json`. For example, package version `0.1.0` must be released with tag `v0.1.0`.

### Known Limitations

- macOS clipboard watching still uses polling.
- macOS builds are not Developer ID signed or notarized.
- Windows builds are unsigned and may trigger SmartScreen.
- There is no cloud sync. History stays on the local machine.
