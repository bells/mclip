# mclip

`mclip` is a lightweight clipboard history app for macOS and Windows, built with Tauri 2, React 19, TypeScript, and Rust.

[中文](#中文) | [English](#english)

## 中文

### 项目简介

`mclip` 是一个常驻托盘的剪贴板历史工具。它专注于桌面日常复制场景：快速唤起、搜索、回填历史内容，并在不打断当前工作的前提下查看更早的记录。

当前版本：`0.1.1`

### v0.1.1 更新重点

- 完成 Tailwind CSS 4 界面迁移，统一主窗口、preview、About、Preferences 和确认弹窗的深浅色视觉与可访问焦点状态。
- 新增跟随系统/浅色/深色主题，以及主界面条数、历史分组条数、复制项序号、主窗口 Logo 等显示偏好。
- 主窗口在大历史条数下固定搜索栏和底部操作区，仅滚动中间历史区域，并按显示器工作区限制窗口高度。
- 历史分组窗口按真实内容自适应高度；hover 详情使用独立 `preview-detail` 窗口，删除入口统一放在详情标题区。
- 文本和文件条目收紧为 28px 行高，图片条目继续保留 64px 行高与完整缩略图；搜索、键盘和鼠标共用同一个激活目标，避免重复高亮。
- 新增独立图片查看器：复用完整详情，打开时直接最大化，可恢复为 720×520，并支持最大化、恢复、删除和 `Escape` 关闭。
- 增强颜色代码、Emoji、长文件名和完整文件路径展示，同时保持原始复制内容不变。
- 运行时只让主窗口进入启动关键路径，preview 家族预热，About、Preferences 和图片查看器按需创建；历史改用 revision snapshot/delta，图片读取使用 32 MiB 有界单飞缓存。Apple M2 实测托盘就绪中位数提升 51.3%，重复图片查看器打开中位数从 384.62 ms 降到 49.37 ms。
- 新安装默认最多保存 200 条历史，可配置上限提升到 500；`mclip-cli` 增加无需读取历史文件的 help/version，并通过版本感知、SHA-256 校验和可回滚替换安全安装/升级。

上述性能数据来自 Apple M2、macOS release 构建、固定匿名 fixture 的 5 次预热与 20 次正式采样，不代表 Windows 真机结果；完整数据见 [`performance/final-v0.1.1-runtime-performance.md`](performance/final-v0.1.1-runtime-performance.md)。

### 主要功能

- 托盘常驻，点击托盘图标显示或隐藏主窗口。
- 全局快捷键 `CommandOrControl+Shift+V` 唤起或隐藏主窗口。
- 支持文本、图片、文件三类剪贴板历史；文件历史可回填为系统文件列表，方便继续粘贴文件本身。
- 历史记录本地保存，重复内容会合并并移动到最前。
- 支持将常用文本、图片和文件置顶；置顶记录固定显示在普通历史之前，不占用主窗口或历史分组条数，并且不会被自动历史裁剪删除。最多可置顶 100 条。
- 主窗口默认展示最新 10 条，更多记录默认按每 50 条分组；两个展示条数都可在偏好设置中调整。
- 历史分组使用独立透明 preview 窗口，不会撑宽主窗口。
- 支持单条历史详情、分组 hover 详情、独立大图查看器、图片缩略图、颜色代码 swatch、常用表情放大展示和文件详情。
- 文件列表会对过长文件名做中间省略并保留扩展名；文件详情会显示完整绝对路径和完整文件名。
- 支持搜索、方向键选择、回车复制、`Esc` 收起窗口；搜索、键盘和鼠标导航使用统一激活目标。
- 支持偏好设置：登录时启动、界面语言、外观主题、菜单栏图标样式、自动粘贴、最大历史条数、主界面/历史分组展示条数、复制项序号显示、主界面 Logo 显示和保存类型。
- 关于窗口支持手动检查 GitHub Releases 上的新版本。
- 支持中文、英文和日文界面，语言可选择跟随系统；`zh` locale 显示中文，`ja` locale 显示日文，其它未支持语言显示英文。`mclip-cli` 的命令名、帮助和输出仍以英文为准。

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
npm run cli -- get --index 1 --json --reveal-secrets
npm run cli -- search "panic" --json
npm run cli -- context --last 3 --format markdown
npm run cli -- add "note from agent"
npm run cli -- copy --index 1
printf '%s' 'pipeline clipboard text' | npm run cli -- copy
printf '%s' '{"ok":true}' | npm run cli -- transform json-prettify
npm run cli -- transform url-component-encode --text "docs/mclip quick actions"
npm run cli -- delete --id h_xxx
npm run cli -- pin --id h_xxx
npm run cli -- list --pinned --json
npm run cli -- unpin --index 1
npm run cli -- clear --yes --keep-pinned
npm run cli -- clear --yes
```

CLI 默认读取本机 mclip 配置目录中的 `history.json`。排查或测试时可以显式指定路径：

```bash
npm run cli -- --history-path /path/to/history.json list --json
```

偏好设置的“Agent CLI”页会运行固定安装路径下的 `mclip-cli --version`，显示已安装版本和当前桌面版对应的目标版本，并区分未安装、可升级、版本未知、当前版本和较新版本。未安装时可以安装，旧版或无法识别版本的 legacy CLI 可以升级，当前版本可以重新安装；较新版本不会被自动降级。macOS 默认安装到 `~/.local/bin/mclip-cli`，Windows 默认安装到 `%LOCALAPPDATA%\mclip\bin\mclip-cli.exe`（缺少 `LOCALAPPDATA` 时回退到用户目录）；不会使用 `sudo`、修改 shell profile 或写系统级安装目录。

也可以直接从命令行安装：

```bash
curl -fsSL https://www.mclip.cn/install.sh | sh
```

Windows CLI 用户请在 Git Bash（或兼容的 POSIX shell）中执行该命令；桌面应用仍应使用 GitHub Releases 提供的 `.msi` 或 `.exe` 安装包。

当前 CLI 不启动桌面 UI。`--help`/`help` 输出帮助，`--version`、`-V` 和 `version` 输出与 mclip 产品 Release 一致的版本号，且这些信息命令不会读取历史文件。`agent` 会输出一个面向 AI Agent 的聚合包，包含最近历史、可用命令能力表和安全边界，默认 Markdown，也支持 `--json`；`list/search/context/agent --pinned` 只返回置顶记录；`pin` 和 `unpin` 使用稳定 ID 或当前快照的一位起始序号；`clear --yes` 仍清除全部历史并报告其中的置顶条数，`clear --yes --keep-pinned` 只清除普通历史。`add` 会把文本写入历史但不覆盖当前系统剪贴板；`copy --index|--id` 保留原有选择语义，`copy --stdin` 或隐式管道会把唯一的 UTF-8 输入写入系统剪贴板但不直接修改历史。`transform <action>` 支持 JSON 格式化/压缩、RFC 4648 Base64 和 URL component 编解码，成功 stdout 只包含结果，不读历史也不写剪贴板。桌面文本详情使用相同 Rust 变换服务，在独立结果窗口中预览；复制结果走普通剪贴板监听，替换原记录则必须确认并保留稳定 ID 与置顶状态。输入上限为 1 MiB，输出上限为 4 MiB。偏好设置会下载与当前桌面版本完全一致的 GitHub Release 资产；公开安装脚本默认下载最新公开 Release，也可通过 `MCLIP_VERSION` 固定版本。两条预构建安装路径都会先验证同 Release 的 SHA-256 资产，校验失败时保留旧 CLI。只有预构建二进制不存在时，公开脚本才回退到本地或源码构建并要求 Rust/Cargo 和 Git。

v0.2.0 开发版会在 `list`、`get`、`search`、`context` 和 `agent` 的 Text、Markdown、JSON 输出中默认遮罩已分类的敏感文本。`--raw` 和 `--reveal-secrets` 只为当前命令显式显示本地原文；`copy` 仍把用户选中的原始内容写回剪贴板，但不会在操作结果中回显。检测是有界的高置信度启发式规则，可能误报或漏报，不能替代凭证管理。

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

置顶字段以兼容旧版的附加 JSON 字段保存。v0.1.1 的 serde 模型会忽略这些未知字段，因此可以读取 v0.2.0 的文件；但旧版不理解置顶保护，可能把这些记录当普通历史裁剪。降级前应先备份 `history.json` 和 `history-assets/`，需要回到新版时再恢复备份。

应用本身不会上传剪贴板内容。只有在你手动点击“检查更新”时，应用会请求 GitHub Releases 的最新版本信息。Windows 安装器仅在缺少 WebView2 运行时时可能联网下载运行时组件。

v0.2.0 开发版新增本地敏感内容分类、默认遮罩和可配置的来源应用排除。遮罩只保护界面与默认 CLI 输出，不是静态加密：原始文本仍以本地明文保存在 `history.json` 中，以保证复制内容逐字节一致。检测只覆盖一组版本化的高置信度模式，可能误报或漏报；来源应用识别同样是 best-effort，macOS 使用 bundle ID、Windows 使用可执行文件名、X11 使用 `WM_CLASS`，纯 Wayland 当前不可用。不要把这些能力当成密码管理器、DLP 或泄露防护保证。

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
npm run site:test
npm run site:build
```

`npm run check` 会执行前端构建、Rust 格式检查、Rust 单元测试、Rust 编译检查和 clippy。发布前还应运行 `npm run site:test`、`npm run site:build` 和 `git diff --check`。

在 macOS 上可以额外运行下面的 Windows 目标编译检查；它能发现条件编译、Windows API 和依赖层面的错误，但不能替代 Windows 真机交互与安装测试：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

官网位于 `site/`，使用 Astro 生成静态页面。`npm run site:dev` 用于本地预览官网，`npm run site:build` 会输出到 `site/dist/`。

Vercel 部署时，根路径 `/` 由 `site/vercel.json` 在边缘层重定向到 `/en/`，默认进入英文官网，避免先渲染临时中转页面再跳转。

### 发布

Release 由 GitHub Actions 触发：

```bash
git tag v0.1.1
git push origin v0.1.1
```

发布前必须保证 tag、根 `package.json`/lockfile、官网 package/lockfile、Cargo package/lockfile 和构建后的 `mclip-cli --version` 完全一致，例如产品版本为 `0.1.1` 时 tag 必须是 `v0.1.1`。Release workflow 会同时构建 macOS/Windows 安装包、受支持架构的 `mclip-cli` 预构建资产及其 `.sha256` 校验资产，并生成 draft release。

发布前可检查 Draft 的 CLI 资产：

```bash
gh release view v0.1.1 --repo bells/mclip --json isDraft,assets --jq '{isDraft, assets: [.assets[].name]}'
```

必须同时看到 `mclip-cli-darwin-arm64`、`mclip-cli-darwin-arm64.sha256`、`mclip-cli-windows-x64.exe` 和 `mclip-cli-windows-x64.exe.sha256`；Release workflow 会在两个平台任务结束后下载并复核这四个资产。发布 Draft、移动已有 tag 或替换远端资产属于单独的发布操作，不由构建或普通代码验证自动执行。

### 当前限制

- macOS 剪贴板监听仍使用轮询，但只轮询 `NSPasteboard.changeCount`，检测到变化后才读取完整剪贴板内容。
- macOS 未做 Developer ID 签名和 notarization。
- Windows 未做代码签名，可能触发 SmartScreen。
- 当前没有云同步，历史只保存在本机。

## English

### Overview

`mclip` is a tray-first clipboard history app for everyday desktop copying. It is designed to open quickly, stay compact, search local history, and restore previous clipboard items without taking over the screen.

Current version: `0.1.1`

### v0.1.1 Highlights

- Completes the Tailwind CSS 4 UI migration across the main window, previews, About, Preferences, and confirmation surfaces, with consistent light/dark styling and visible focus states.
- Adds System/Light/Dark appearance plus configurable main/archive counts, row numbers, and main-window branding.
- Keeps search and footer actions fixed for large history counts, scrolls only the history region, and caps the native window to the monitor work area.
- Sizes archive previews from rendered content, moves hover details into the independent `preview-detail` window, and keeps deletion in the detail header.
- Tightens text and file rows to 28px while preserving 64px image rows and full thumbnails. Search, keyboard, and pointer input share one active target instead of drawing competing highlights.
- Adds a dedicated image viewer that reuses the full detail surface, opens maximized, restores to 720×520, and supports maximize, restore, delete, and Escape-to-close.
- Improves color-code, emoji, long-file-name, and full-path presentation without changing copied content.
- Keeps only the main window on the startup path, warms the preview family, and creates About, Preferences, and the image viewer on demand. Revisioned snapshot/delta updates and a bounded 32 MiB single-flight image cache reduce hidden-window work. On an Apple M2, measured tray-ready median improved 51.3%, while repeated viewer-open median fell from 384.62 ms to 49.37 ms.
- New installs keep 200 history items by default with a configurable maximum of 500. CLI help/version stay history-independent, while version-aware SHA-256 verification and recoverable replacement protect installs and upgrades.

These performance results come from an Apple M2 macOS release build with an anonymized fixed fixture, 5 warm-ups, and 20 measured runs. They are not Windows device evidence; see [`performance/final-v0.1.1-runtime-performance.md`](performance/final-v0.1.1-runtime-performance.md) for the complete report.

### Features

- Runs from the tray or menu bar.
- Toggle the main window with `CommandOrControl+Shift+V`.
- Saves text, image, and file clipboard history. File history is restored as a system file list, so files can be pasted again as files.
- Keeps history locally, deduplicates repeated content, and moves reused items to the top.
- Pins frequently reused text, images, or files ahead of ordinary history. Pins do not consume main/archive counts and are protected from automatic retention; up to 100 items can be pinned.
- Shows the latest 10 items in the main window by default, with older items grouped by 10 by default; both display counts are configurable in Preferences.
- Uses a separate transparent preview window for grouped history, so the main window stays compact.
- Supports item details, grouped hover details, a dedicated image viewer, image thumbnails, color-code swatches, common emoji display, and file details.
- Long file names are middle-ellipsized in lists to preserve extensions, while file details show the full absolute path and full file name.
- Supports search, arrow-key selection, Enter-to-copy, and Escape-to-hide, with one active target shared by search, keyboard, and pointer navigation.
- Preferences include launch at login, display language, appearance theme, menu bar icon style, auto paste, maximum history count, main/group display counts, row number visibility, main-window logo visibility, and enabled content types.
- The About window can manually check GitHub Releases for a newer version.
- Supports Chinese, English, and Japanese UI. Follow System resolves `zh` locales to Chinese, `ja` locales to Japanese, and unsupported locales to English. `mclip-cli` command names, help, and output remain English-first.

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
npm run cli -- get --index 1 --json --reveal-secrets
npm run cli -- search "panic" --json
npm run cli -- context --last 3 --format markdown
npm run cli -- add "note from agent"
npm run cli -- copy --index 1
printf '%s' 'pipeline clipboard text' | npm run cli -- copy
printf '%s' '{"ok":true}' | npm run cli -- transform json-prettify
npm run cli -- transform url-component-encode --text "docs/mclip quick actions"
npm run cli -- delete --id h_xxx
npm run cli -- pin --id h_xxx
npm run cli -- list --pinned --json
npm run cli -- unpin --index 1
npm run cli -- clear --yes --keep-pinned
npm run cli -- clear --yes
```

By default, the CLI reads `history.json` from the local mclip app configuration directory. For troubleshooting or tests, pass an explicit path:

```bash
npm run cli -- --history-path /path/to/history.json list --json
```

The Agent CLI tab in Preferences probes `mclip-cli --version` at the fixed user-level install path, shows the installed and desktop-target versions, and distinguishes missing, outdated, unknown legacy, current, and newer CLIs. It offers Install, Upgrade, or Reinstall as appropriate and never downgrades a newer CLI automatically. The default path is `~/.local/bin/mclip-cli` on macOS and `%LOCALAPPDATA%\mclip\bin\mclip-cli.exe` on Windows (falling back to the user profile when `LOCALAPPDATA` is unavailable). It does not use `sudo`, edit shell profiles, or write to system-wide directories.

You can also install directly from the terminal:

```bash
curl -fsSL https://www.mclip.cn/install.sh | sh
```

Windows CLI users should run this command from Git Bash or another POSIX-compatible shell. The desktop app should still be installed from the `.msi` or `.exe` asset on GitHub Releases.

The current CLI does not start the desktop UI. `--help`/`help` prints help, and `--version`, `-V`, and `version` print the shared mclip product Release version without reading the history file. `agent` emits an AI-agent-ready bundle with recent history, command capabilities, and safety boundaries; it defaults to Markdown and supports `--json`. `list/search/context/agent --pinned` returns only pins; `pin` and `unpin` use a stable ID or a one-based index from the current snapshot. `clear --yes` still clears everything and reports the pinned count, while `clear --yes --keep-pinned` removes only ordinary history. `add` writes text into history without replacing the current system clipboard. `copy --index|--id` preserves selector behavior, while `copy --stdin` or implicit piped stdin writes the sole UTF-8 input to the system clipboard without directly mutating history. `transform <action>` provides JSON prettify/minify, RFC 4648 Base64, and URL-component encode/decode; successful stdout is content-only, and the command reads no history and writes no clipboard. Desktop text details use the same Rust service in an independent result window: Copy follows the normal watcher, while Replace requires confirmation and preserves the stable ID and pin state. Input is limited to 1 MiB and output to 4 MiB. Preferences downloads the GitHub Release asset for the exact desktop version; the public installer defaults to the latest published Release and accepts `MCLIP_VERSION` for a pinned install. Both prebuilt paths verify the companion SHA-256 asset before replacement and preserve the previous CLI on failure. The public script falls back to local/source builds only when a prebuilt binary is missing, so Rust/Cargo and Git are not required for the normal path.

The in-development v0.2.0 CLI masks classified sensitive text by default in Text, Markdown, and JSON output from `list`, `get`, `search`, `context`, and `agent`. `--raw` and `--reveal-secrets` explicitly reveal local plaintext for that invocation only. `copy` still writes the exact selected content to the clipboard without echoing it in the action result. Detection is a bounded, high-confidence heuristic and can produce false positives or false negatives; it is not a credential manager.

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

Pin metadata is stored as additive JSON fields that the v0.1.1 serde model ignores, so it can parse a v0.2.0 history file. The older app does not understand pin protection and may trim those entries as ordinary history. Before downgrading, back up both `history.json` and `history-assets/`, then restore that backup when returning to the newer version.

The app does not upload clipboard contents. It requests the latest GitHub Releases version only when you manually click “Check for Updates”. On Windows, the installer may access the network only to download WebView2 when the runtime is missing.

The in-development v0.2.0 privacy controls add local sensitive-text classification, masked presentation, and configurable source-application exclusions. Masking protects the UI and default CLI output; it is not encryption at rest. Original text remains local plaintext in `history.json` so explicit copy stays byte-exact. The versioned detector intentionally covers only a small high-confidence set and can miss secrets or mask ordinary text. Source identity is also best-effort: macOS uses a bundle ID, Windows a normalized executable name, and X11 `WM_CLASS`; pure Wayland source exclusion is currently unavailable. These controls are not a password manager, DLP system, or breach-prevention guarantee.

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
npm run site:test
npm run site:build
```

`npm run check` runs the frontend build, Rust formatting check, Rust tests, Rust compile check, and clippy. Before release, also run `npm run site:test`, `npm run site:build`, and `git diff --check`.

On macOS, the following Windows-target compile is an additional check for conditional compilation, Windows APIs, and dependency compatibility. It does not replace interaction and installer testing on a real Windows machine:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

The product site lives in `site/` and uses Astro to generate static pages. Use `npm run site:dev` to preview it locally and `npm run site:build` to write `site/dist/`.

On Vercel, the root path `/` is redirected to `/en/` by `site/vercel.json` at the edge layer, making the English site the default and avoiding a temporary redirect page flash.

### Release

GitHub Actions publishes release drafts from version tags:

```bash
git tag v0.1.1
git push origin v0.1.1
```

The tag, root package and lockfile, site package and lockfile, Cargo package and lockfile, and built `mclip-cli --version` must all match. For example, product version `0.1.1` must be released with tag `v0.1.1`. The workflow builds macOS/Windows installers plus each supported `mclip-cli` binary and its `.sha256` companion, then creates a draft release.

Inspect the draft CLI assets before publication:

```bash
gh release view v0.1.1 --repo bells/mclip --json isDraft,assets --jq '{isDraft, assets: [.assets[].name]}'
```

The draft must contain `mclip-cli-darwin-arm64`, `mclip-cli-darwin-arm64.sha256`, `mclip-cli-windows-x64.exe`, and `mclip-cli-windows-x64.exe.sha256`. After both platform jobs finish, the Release workflow downloads and revalidates all four. Publishing the draft, moving an existing tag, or replacing remote assets is a separate release-owner action and is never performed implicitly by a build or ordinary source verification.

### Known Limitations

- macOS clipboard watching still uses polling, but it only polls `NSPasteboard.changeCount` and reads full clipboard contents after a detected change.
- macOS builds are not Developer ID signed or notarized.
- Windows builds are unsigned and may trigger SmartScreen.
- There is no cloud sync. History stays on the local machine.
