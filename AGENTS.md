# AGENTS.md

## 项目定位

`mclip` 是一个跨平台剪贴板历史工具，目标平台是 macOS 和 Windows。它是托盘优先的桌面小工具，不是常驻大窗口应用。

技术栈：

- 前端：React 19、TypeScript、Vite、Tailwind CSS 4
- 桌面壳：Tauri 2
- 后端：Rust
- 官网：Astro 6，目录 `site/`
- 打包发布：GitHub Actions + `tauri-apps/tauri-action`

当前版本：`0.1.1`。应用版本以根目录 `package.json` 为发布真相，Tauri 通过 `src-tauri/tauri.conf.json` 的 `"version": "../package.json"` 读取；Cargo 和官网 package 版本也要同步。

适用 skill：

- `frontend-design`：改主窗口、preview、关于窗口、偏好设置或官网展示时使用。应用界面应保持桌面工具的紧凑、清晰、可快速扫描；官网应以真实产品工作流为主，不用无关装饰替代产品。
- `tauri-v2`：改 Tauri 2 配置、窗口、权限、Rust 命令、插件、打包配置或跨平台桌面行为时使用。

## 核心体验

- 托盘或菜单栏常驻，点击托盘图标显示或隐藏主窗口。
- macOS 菜单栏图标设置稳定 `NSStatusItem.autosaveName`，用于恢复用户拖动后的菜单栏位置；不要承诺可强制最右排序。
- macOS 的浅色菜单栏图标必须设置为原生 Template Image，让系统根据菜单栏/壁纸/深浅色状态自动着色。
- 全局快捷键 `CommandOrControl+Shift+V` 唤起或隐藏主窗口。
- 保存文本、图片、文件三类剪贴板历史；文件历史选择后应回填系统文件列表，而不是普通路径文本。
- 去重后最新内容在最前，同一内容重复复制会更新次数和时间。
- 常用历史可置顶，按最近置顶时间排列在普通历史之前；置顶不占普通历史上限或主界面/分组条数，最多 100 条，重复复制保留置顶时间。
- 主窗口默认显示最新 10 条，更多历史默认按每 50 条分组；主界面条数和历史分组条数都可在偏好设置里调整。
- 文本和文件列表使用紧凑行高，图片条目保留更高的缩略图行；不要为了统一高度压缩图片。
- 历史分组和单条详情都使用独立透明 preview 窗口，不把预览塞回主窗口 DOM。
- 图片详情可打开独立 `image-viewer`，默认最大化，支持恢复、删除和 `Escape` 关闭。
- 支持偏好设置：登录时启动、语言、外观主题、菜单栏图标样式、自动粘贴、最大历史条数、主界面/历史分组展示条数、复制项序号显示、主界面 Logo 显示、保存类型。
- 支持 About 独立窗口，展示版本、GitHub 地址和真实应用图标。

## 常用命令

```bash
npm ci
npm run tauri:dev
npm run check
node --test tests/*.test.mjs
npm run tauri:build
npm run cli -- list --limit 5 --json
npm run cli:test
npm run cli:build
npm run cli:install
npm run site:test
npm run site:build
```

`npm run check` 会执行：

- 前端构建：`tsc && vite build`
- Rust 格式检查：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- Rust 单元测试：`cargo test --manifest-path src-tauri/Cargo.toml`
- Rust 编译检查：`cargo check --manifest-path src-tauri/Cargo.toml`
- Rust clippy：`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

`npm run check` 不包含根目录 `tests/*.test.mjs`，涉及前端契约、性能或窗口生命周期时还要单独跑 `node --test tests/*.test.mjs`。提交前优先跑这两道门禁。如果只改 TSX/CSS 文档化小界面，可以先跑 `npm run build` 快速确认，再跑完整检查。官网或发布文案有变化时还要跑 `npm run site:test`、`npm run site:build` 和 `git diff --check`。

CLI 是 AI Agent/终端入口。`npm run cli -- ...` 会运行 `mclip-cli`，默认读取本机 mclip 配置目录的 `history.json`；测试或排查时可用 `--history-path /path/to/history.json` 指定文件。当前支持 `--help`/`help`、`--version`/`-V`/`version`，Agent 聚合命令 `agent`、只读命令 `list/get/search/context`，以及操作命令 `add/copy/delete/pin/unpin/clear`。help/version 不应读取历史文件；CLI 与桌面应用共用产品版本，Release 前 tag、两个 package/lockfile、Cargo package/lockfile 和构建后二进制输出必须一致。`agent` 输出最近历史、命令能力表和安全边界，默认 Markdown，`--json` 输出结构化包；五个只读命令默认遮罩已分类的敏感文本，`--raw` 或 `--reveal-secrets` 只为当前调用显式显示原文；Agent 默认语义变更后 schema 为 2。`add` 只写历史不覆盖系统剪贴板，`copy` 才会写回原始内容且操作结果不得回显内容；`pin/unpin` 支持稳定 ID 或一位起始序号，read/Agent 命令支持 `--pinned`；`clear` 必须带 `--yes`，`--keep-pinned` 只清普通历史。`npm run cli:test` 是 CLI 的快速回归测试，`npm run cli:install` 会把 `mclip-cli` 安装到用户目录。因为 Cargo 包里同时有 `mclip` 和 `mclip-cli` 两个 binary，`src-tauri/Cargo.toml` 必须保留 `default-run = "mclip"`，否则 Tauri dev 内部裸 `cargo run` 会不知道启动哪个 binary。

## 代码地图

```text
install.sh                             mclip-cli 的 curl | sh 安装脚本，默认安装到用户目录
site/public/install.sh                 Vercel 官网公开的安装脚本副本，必须和根目录 install.sh 保持一致
site/vercel.json                       官网 Vercel 配置，根路径 / 直接 307 跳转到 /en/
site/src/pages/{zh,en}/index.astro     双语官网首页
site/src/pages/{zh,en}/changelog.astro 双语版本更新日志
site/public/llms.txt                   AI/搜索可读取的公开产品事实
site/public/videos/                    官网 Hero 视频及 poster
site/scripts/render-hero-video.m       使用 macOS AVFoundation 生成可复现 Hero MP4/poster
performance/final-v0.1.1-runtime-performance.md
                                        v0.1.1 性能协议、结果与验证边界

src/
  App.tsx                             根据六个 Tauri window label 分流，并渲染对应窗口 shell
  styles.css                          Tailwind 入口、全局 reset、语义主题 token
  uiStyles.ts                         组件 Tailwind class 映射；样式迁移后不再使用 App.css
  constants.ts                        app 名称、GitHub URL、preview 宽度、默认设置
  i18n.ts                             中文和英文文案表
  types.ts                            前后端共享的 camelCase 数据类型
  hooks/useClipboardApp.ts            组合数据、操作和 preview controller 的主入口
  hooks/useClipboardDataController.ts 历史/设置读取、事件订阅、过滤与分组
  hooks/useHistoryPreviewController.ts
                                      preview 状态、请求 revision、跨窗口 payload 与尺寸
  services/ipc/commands.ts            typed Tauri command 封装
  services/ipc/events.ts              typed Tauri event 封装
  services/ipc/windows.ts             当前/主窗口操作
  services/auxiliaryWindows.ts        按需辅助窗口 ready 协议与 listener token
  services/performance.ts             默认关闭的前端性能里程碑
  lib/tauri.ts                        对组件保留的 IPC 兼容 facade
  components/AppHeader.tsx            搜索栏
  components/HistoryList.tsx          最新历史列表，文件名列表展示使用中间省略以保留扩展名
  components/HistoryGroupNav.tsx      历史分组按钮
  components/HistoryPreviewWindow.tsx 独立 preview 容器，按 payload kind 分发
  components/HistoryGroupPreviewWindow.tsx
                                      历史分组 preview 列表与 hover/键盘激活追踪
  components/HistoryItemPreviewWindow.tsx
                                      单条历史详情 preview
  components/HistoryPreviewDetailWindow.tsx
                                      分组 hover 的独立详情窗口
  components/FullscreenImageViewer.tsx 图片历史的独立查看器，复用完整详情并支持最大化与恢复
  components/HistoryDetailPanel.tsx   详情页的三段式外壳
  components/HistoryDetailDeleteButton.tsx
                                      主列表详情/分组详情复用的删除动作
  components/HistoryPinButton.tsx     单条/分组详情和图片查看器标题栏复用的置顶动作
  components/HistoryPreviewDetailContent.tsx
                                      文本/图片/文件详情内容渲染
  components/ImageThumb.tsx           通过 Rust command 读取图片 base64 后渲染
  components/AboutWindow.tsx          关于窗口
  components/PreferencesWindow.tsx    偏好设置窗口
  components/Modal.tsx                主窗口内确认弹窗
  utils/history.ts                    历史过滤、分组、分页和文件名列表展示纯函数
  utils/historyAffordance.ts          颜色代码与 Emoji 的前端展示识别
  utils/preview.ts                    preview 高度和偏移计算
  utils/previewHistory.ts             preview payload 历史 reconciliation
  utils/selectionBehavior.ts          历史选择后的附加行为判断
  utils/settings.ts                   前端设置 normalize
  utils/sensitiveContent.ts           敏感文本展示判断与固定遮罩辅助
  utils/historyChanges.ts             revision snapshot/delta reducer
  utils/imageDataUrl.ts                图片读取与失败处理辅助

src-tauri/
  Info.plist                         macOS bundle 额外配置，声明 LSUIElement 让应用启动时不显示 Dock 图标
  tauri.conf.json                     只声明启动关键路径 main，以及 CSP、bundle、WebView2、签名配置
  capabilities/default.json           全窗口默认权限
  capabilities/desktop.json           桌面端 positioner 权限
  build.rs                            Tauri build script
  src/bin/mclip-cli.rs                独立 CLI 入口，供 AI Agent/终端访问和操作历史
  src/main.rs                         发布版 Windows 隐藏控制台，转入 lib.rs
  src/lib.rs                          Tauri 应用入口、托盘、快捷键、命令注册
  src/agent_cli.rs                    CLI 参数解析、Agent 模式、历史筛选、操作命令和 text/json/raw/markdown 输出
  src/cli_install.rs                  mclip-cli 版本状态、Release 下载、SHA-256 校验和可回滚安装
  src/auxiliary_window_contract.rs    五个辅助窗口纯描述符与 ready generation 状态机
  src/auxiliary_windows.rs            辅助窗口按需创建与前端 listener ready 协议
  src/window.rs                       主窗口与辅助窗口的尺寸、定位、显示隐藏
  src/clipboard.rs                    剪贴板读写、文件列表回填、图片处理、Windows 事件监听、macOS changeCount 轮询
  src/desktop_state.rs                revisioned 历史/设置内存仓库与定向变更广播
  src/history.rs                      历史持久化、去重、裁剪、图片资源清理
  src/image_cache.rs                  32 MiB 总量、8 MiB 单项上限的单飞图片缓存
  src/performance.rs                  默认关闭且不记录剪贴板内容的本地性能里程碑
  src/sensitive_content.rs            64 KiB 有界、版本化的本地敏感文本分类与固定遮罩
  src/settings.rs                     设置持久化、登录启动、系统语言默认值
  src/source_app.rs                   macOS/Windows/X11 稳定来源标识 best-effort 识别与 Wayland 能力状态
  src/storage.rs                      原子写文件工具

.github/workflows/
  ci.yml                              macOS 和 Windows 检查
  release.yml                         tag 发布打包，生成 draft release 和 mclip-cli 资产

src-tauri/tests/
  agent_cli.rs                        CLI 真实二进制集成测试，覆盖 agent/list/get/search/context/add/delete/clear
  cli_install.rs                      CLI 安装检测、复制和安装命令回归测试
```

## 前端状态流

`src/hooks/useClipboardApp.ts` 是组合入口，数据状态集中在 `useClipboardDataController.ts`，preview 生命周期集中在 `useHistoryPreviewController.ts`。

主要职责：

- 启动时并行读取设置和带 revision 的历史 snapshot。
- 监听后端 `history-changed` 事件，按 `upsert/remove/clear/replace` delta 更新；revision 不连续时重新读取 snapshot。
- 监听后端 `settings-updated` 事件刷新语言和偏好设置。
- 根据搜索词计算 `filteredHistory`。
- 按设置计算主窗口显示条数和历史分组条数，主窗口默认 10，历史分组默认 50。
- 维护 `previewHistoryGroupIndex`、`previewHistoryItemId`、`previewAnchorTop` 和 async request revision。
- 调用 `adjust_window_height_to_content`，由 Rust 按显示器工作区限制主窗口高度。
- 推送 item/group payload 到 `preview`，推送分组激活项 payload 到独立 `preview-detail`。
- 接收分组 DOM 实测高度，通过 `resize_history_preview_window` 只调整高度并保留当前 X。
- 处理复制、自动粘贴、删除、清空历史、打开 About、打开 Preferences、退出应用等操作。

维护注意：

- `searchQueryRef` 用来避免事件回调拿到旧搜索词闭包。
- `previewHistoryGroupIndex`、`previewHistoryItemId` 和 `previewAnchorTop` 必须一起维护。
- 关闭 preview 时要清理延迟关闭 timer。
- 异步 show 完成前必须核对 request revision 和当前 active item，避免旧请求把已关闭或已切换的详情重新打开。
- 搜索词变化、新剪贴板内容进入、删除条目、打开 About/Preferences 时都要关闭旧 preview。
- `preview`、`preview-detail`、`about`、`preferences`、`image-viewer` 都可能是首次使用时才创建；发 payload 或 show 前必须经过 `ensure_auxiliary_window` 与 ready 确认。

## 窗口模型

运行时共有六个窗口，但 `tauri.conf.json` 只预创建 `main`。其余五个窗口由 `src-tauri/src/auxiliary_windows.rs` 的描述符按需创建；托盘 ready 后只预热 `preview` 和 `preview-detail`，About、Preferences、图片查看器首次使用时创建并在 hide 后保留。

- `main`：主界面，宽度固定 `320`，不可由用户手动 resize。
- `preview`：独立透明预览窗口，用于单条详情和历史分组列表，默认隐藏。
- `preview-detail`：分组 hover 时的独立详情窗口，默认隐藏。
- `image-viewer`：图片历史的独立查看窗口，复用完整历史详情并直接最大化打开；恢复 frame 为 720×520，可聚焦并支持最大化、恢复与 Escape 关闭。打开期间主窗口保持 visible 但临时退出置顶层级，因此会被 viewer 覆盖；关闭后恢复主窗口原有层级与失焦隐藏行为。
- `about`：关于窗口，固定尺寸，默认隐藏。
- `preferences`：偏好设置窗口，固定尺寸，默认隐藏。

辅助窗口创建由 `AuxiliaryWindowRegistry` 对并发请求去重，并等待前端 listener ready 后再允许调用方发送首个 payload。不要退回“六个 WebView 全部随进程启动”的配置。

preview 必须保持独立窗口：

- 主窗口不应该为了右侧预览被撑宽。
- 主窗口高度只跟左侧列表、分组行和 footer 有关。
- 分组 preview 始终保持接近主窗口的宽度；hover 到具体条目时由独立 `preview-detail` 窗口显示详情，不扩展分组窗口。
- preview 窗口必须 `set_focusable(false)`，避免它抢焦点后触发 main 失焦隐藏。

关键实现：

- 前端 `HistoryGroupNav` 和 `HistoryList` 用 `getBoundingClientRect().top` 传入 anchor top。
- Rust `show_history_preview_window` 根据 main 窗口位置、anchor、preview 尺寸和屏幕边界定位。
- Rust `show_history_preview_detail_window` 保持分组 preview 原位，把独立详情紧贴在分组左侧或右侧；外侧放不下时只翻转详情，允许详情覆盖主窗口。尺寸与位置统一使用分组窗口所在显示器的 scale factor 和物理坐标，一次性应用，避免隐藏详情窗口的旧 frame/scale 造成重叠。
- `resize_history_preview_window` 只能根据实测内容调整分组高度和 Y，不得改变当前 X，否则会覆盖已经打开的独立详情。
- `PREVIEW_WINDOW_GAP` 是 `0.0`，保持主窗口和 preview 贴边，避免鼠标穿过空白缝隙导致 hover 断掉。

## 运行时性能边界

- 正常历史变更通过带 revision 的 delta 定向发送；不要恢复成向六个窗口广播完整历史数组。外部文件 reconciliation 等异常路径仍可使用 typed `replace`。
- 图片 data URL 读取统一经过 Rust 单飞缓存：总上限 32 MiB、单项上限 8 MiB。删除、清空、裁剪、外部替换和未使用资源清理必须同步失效缓存。
- 性能里程碑默认关闭，只在 `MCLIP_PERF_MODE=1` 时记录枚举、耗时、fixture 数量、window label 和匿名 interaction id；禁止加入剪贴板文本、查询、路径、来源应用名或图片字节。
- Apple M2/macOS release 的当前证据：`processEntry -> trayReady` 中位数 449.12 ms 降至 218.51 ms，重复 viewer shell 中位数 384.62 ms 降至 49.37 ms。数据只证明该协议下的 macOS 结果，不可外推为 Windows 真机结论。
- 完整协议和仍待验证的 pointer/Windows 边界见 `performance/final-v0.1.1-runtime-performance.md`。

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
- `HistoryGroupPreviewWindow` 使用 pointermove 主动追踪，并通过 Tailwind 状态 class 展示激活行。
- `data-preview-item-id` 是 hover 高亮和 `document.elementFromPoint(...)` 追踪的关键，不要移除。

不要把 pointermove 逻辑改成只在 button 上 `onMouseEnter`。透明独立 Tauri 窗口里快速移动时容易丢事件。

## 剪贴板监听

文件：`src-tauri/src/clipboard.rs`

平台策略：

- Windows：使用 Win32 `AddClipboardFormatListener` 和 message-only window 监听 `WM_CLIPBOARDUPDATE`。
- macOS：每 500ms 轻量读取 `NSPasteboard.changeCount`，只有计数变化后才读取完整剪贴板。
- 其它非 Windows：使用轮询，每 500ms 读取一次剪贴板。

内容策略：

- 按偏好设置里的 `enabledHistoryTypes` 判断保存文本、图片、文件。
- 文件列表优先于图片数据，避免复制文件时被误判。
- 如果剪贴板文本完整由 `file://` URL 行组成，且文件类型启用，应转换为文件历史，而不是保存成普通文本。
- 回填 `HistoryEntry::Files` 时必须写入系统文件列表格式，支持 Finder/Explorer 继续把它当文件粘贴；不要退化成写入绝对路径字符串。
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
- CLI 通过 `load_history_from_path` 复用同一份历史解析逻辑；桌面端历史损坏时仍回退为空并写日志，CLI 会把解析错误输出到 stderr。CLI 写入通过 path-based helper 复用稳定 id、去重、原子写入和图片资源清理逻辑。
- CLI 安装默认写到用户目录：macOS/Linux 使用 `~/.local/bin/mclip-cli`，Windows 使用 `%LOCALAPPDATA%\mclip\bin\mclip-cli.exe`（必要时回退到用户目录）；不要在未明确确认前写 `/usr/local/bin`、系统级 Windows 目录、修改 shell profile 或使用 `sudo`。
- Preferences 的 Agent CLI 页直接探测固定安装路径的 `mclip-cli --version`，状态为 `notInstalled/current/outdated/newer/unknown`；旧版和 unknown 可以升级，current 可以重装，newer 不自动降级。生产安装必须下载与当前桌面版本完全一致的受支持 Release 资产及其 `.sha256`，校验成功后才能可回滚地替换旧 CLI，不依赖 Cargo/Git。
- 公开安装命令使用 `curl -fsSL https://www.mclip.cn/install.sh | sh`；Windows 用户需要在 Git Bash 或兼容 POSIX shell 中运行。脚本默认下载最新公开 Release，可用 `MCLIP_VERSION` 固定版本；预构建资产必须同时下载和验证 `.sha256`，校验失败不得覆盖旧 CLI。只有二进制资产不存在时才回退到本地/源码构建。`site/public/install.sh` 由 Vercel 静态托管，内容必须和根目录 `install.sh` 保持一致。
- 新内容先生成稳定 id，再与已有历史合并。
- 新安装默认最多保存 200 条历史，可配置范围为 10..=500；超过最大条数会截断。
- 删除和裁剪历史后要清理未使用图片资源。
- Rust 序列化字段必须保持前端需要的 camelCase，例如 `filePaths`、`imagePath`、`byteSize`、`contentHash`。
- 文件历史详情必须显示完整绝对路径和完整文件名；主列表和分组 preview 列表可以对长文件名做中间省略，但要保留扩展名。

设置文件：

- 由 `src-tauri/src/settings.rs` 管理。
- 存在系统 app config 目录的 `settings.json`。
- 字段包括 `launchAtLogin`、`language`、`menuBarIconStyle`、`autoPaste`、`maxHistoryCount`、`enabledHistoryTypes`、`mainWindowItemCount`、`historyGroupItemCount`、`showHistoryItemNumbers`、`showMainWindowBrand`、`appearanceTheme`、`maskSensitiveContent`、`ignoredSourceAppIds`。
- 每条 `HistoryEntryCommon` 还包含 `isPinned` 与 `pinnedAt`；旧文件缺省为未置顶，read-only load 只在内存修复非法组合，不单独改写文件。
- 前端有 `normalizeSettings`，后端有 `AppSettings::sanitize`，改边界时两边都要同步考虑。

隐私保护：

- 敏感文本检测只在本地执行，detector v1 最多扫描 64 KiB，仅覆盖 PEM 私钥头、JWT 形态、AWS `AKIA`/`ASIA` 和 OpenAI `sk-proj-`/`sk-svcacct-`；不要加入宽泛 `sk-` 或熵检测而不升级版本和重新评审误报边界。
- 原始文本仍是持久化与复制真相；遮罩固定为 `••••••••`，只用于桌面和 CLI 默认展示，不得保留原文前后缀，也不得描述为静态加密。
- 旧历史只在用户从 Privacy Preferences 显式触发时重新分类；单纯读取 v0.1.1 文件不得改写。
- 来源排除匹配稳定、规范化后的精确标识：macOS bundle ID、Windows 可执行文件名、X11 `WM_CLASS`；纯 Wayland 必须报告 unavailable，不得声称已执行排除。
- 新增日志、错误、性能记录和能力诊断只能包含稳定 reason code 与有界元数据，不能包含剪贴板内容、匹配片段、私有路径、来源名称或忽略标识。

语言规则：

- `language` 字段支持 `system`、`zhCn`、`en`，默认值是 `system`。
- `system` 表示跟随系统语言；系统 locale 以 `zh` 开头则解析为中文，其它语言（包括英语和暂不支持的语言）解析为英文。
- 前端文案、日期格式和 Rust 原生托盘 tooltip 展示前都要先解析 `system`，不要直接把 `system` 当作可展示语言。
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
- `image-viewer`
- `about`
- `preferences`

必要权限：

- `core:default`
- `core:window:allow-hide`
- `positioner:default`

如果新增 Tauri API 调用，优先检查 capability 是否需要补权限。新增窗口时也要同步更新两个 capability 文件和 `src/App.tsx` 的窗口 label 分流。

透明与圆角：

- Tauri 窗口启用了 `transparent: true`。
- 各窗口根容器的 Tailwind class 仍必须保留圆角、`overflow-hidden`/裁剪和透明背景边界。
- About 和 Preferences 的拖动区域只能是共享 `DialogStatusBar` 的 `[data-dialog-drag-region]`，内容区不可拖动。
- macOS 额外用 `raw-window-handle` + AppKit 给 WebView 和 contentView 做圆角裁剪。

## Windows 覆盖点

Windows 功能必须和 macOS 对齐：

- 托盘点击显示/隐藏。
- 全局快捷键 `CommandOrControl+Shift+V`。
- 文本、图片、文件历史。
- 搜索、选择、复制、删除、清空。
- 历史分组 preview、单条详情 preview、分组 hover 详情。
- 独立图片查看器的最大化、恢复、删除和 Escape 关闭。
- About 和 Preferences 独立窗口。
- 登录时启动。
- 英文/中文界面和系统语言默认值。

Windows 特有实现：

- 剪贴板监听：`AddClipboardFormatListener`。
- 来源应用识别：`GetForegroundWindow`、`GetWindowThreadProcessId`、`QueryFullProcessImageNameW`。
- 登录启动：Startup 目录 `.cmd`。
- 托盘图标排序由 Windows/Explorer 和用户设置控制，当前 Tauri/tray-icon 路径不提供应用级强制靠右能力。
- 安装器：`bundle.windows.webviewInstallMode` 使用 `downloadBootstrapper`，缺少 WebView2 时会静默下载运行时。
- 代码签名：当前未配置，用户可能看到 SmartScreen。

无法在 macOS 本地完整替代 Windows 真机验证。改 Windows 专属代码时，至少跑本地 `npm run check` 和：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

该命令只验证条件编译、Windows API 和依赖兼容；发布结论仍要以 GitHub Actions `windows-2022` 与 Windows 真机 smoke 为准。

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
- 每个 runner 会构建并上传对应平台/架构的 `mclip-cli` 预构建资产
- 发布前校验 tag 版本和 `package.json` 版本一致

发版示例：

```bash
git tag v0.1.1
git push origin v0.1.1
```

发布注意：

- Tauri 版本配置使用 `src-tauri/tauri.conf.json` 里的 `"version": "../package.json"`，安装包文件名会跟随 `package.json`。
- 发版前同步根 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`Cargo.lock`、`site/package.json`、`site/package-lock.json`、官网版本文案和 CLI 输出，再创建同版本 tag。例如产品版本是 `0.1.1`，tag 必须是 `v0.1.1`；Release workflow 会在上传前逐项校验并为每个 CLI 二进制生成同名 `.sha256` 资产。
- Release workflow 的平台矩阵结束后必须从同一 Draft 下载并验证 macOS ARM64、Windows x64 的 CLI 二进制及两个 `.sha256`；发布 Draft、移动 tag 或替换远端资产必须由发布负责人显式执行。
- `release.yml` 的 Release body 需要同时提示 macOS 未 notarize 和 Windows 未签名。

## macOS 发布

当前不使用 Apple Developer ID，不做 notarization。

配置：

```json
"macOS": {
  "infoPlist": "Info.plist",
  "signingIdentity": "-"
}
```

这表示 ad-hoc 签名：

- 可以让 bundle 结构比完全未签名更规整。
- 不能替代 Apple Developer ID。
- 不能消除 Gatekeeper 对 GitHub 下载来源的拦截。

`src-tauri/Info.plist` 里保留 `LSUIElement=true`，让 macOS 把 mclip 当作菜单栏/托盘工具启动，避免启动时在程序坞显示图标。`src-tauri/src/lib.rs` 里的 `ActivationPolicy::Accessory` 和 `set_dock_visibility(false)` 是运行时兜底。

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
- 不要把五个辅助窗口重新写回 `tauri.conf.json` 作为 eager WebView；描述符以 `src-tauri/src/auxiliary_windows.rs` 为真相。
- 不要把 revisioned history delta 改回全窗口全量广播，也不要绕过 `src-tauri/src/image_cache.rs` 直接反复读取同一图片。
- 改 preview 尺寸时，同步检查 `src/constants.ts`、`src/utils/preview.ts`、`src-tauri/src/window.rs` 和 Rust 单元测试。
- 改分组实测高度时同步检查 `src/utils/previewHistory.ts`、`HistoryGroupPreviewWindow.tsx`、`useHistoryPreviewController.ts` 和 `resize_history_preview_window`，后者必须保留 X。
- 改历史条数逻辑时，前端 clamp 和后端 sanitize 都要同步考虑。
- 改主界面/历史分组展示条数时，同步检查 `DEFAULT_MAIN_WINDOW_ITEM_COUNT`、`DEFAULT_HISTORY_GROUP_ITEM_COUNT`、前端 clamp、后端 sanitize、`getHistoryGroups` 和键盘/preview 逻辑。
- 改保存类型时，同步检查 `HistoryKind`、`HistoryTypes`、`PreferencesWindow`、`clipboard.rs` 和 `history.rs`。
- 改文件历史展示时，同步检查 `src/utils/history.ts`、`HistoryList.tsx`、`HistoryGroupPreviewWindow.tsx` 和 `HistoryPreviewDetailContent.tsx`；列表可省略，详情不能省略。
- 改文件复制/粘贴语义时，同步检查 `src-tauri/src/clipboard.rs` 的文件列表读取、`file://` 文本兼容和 `HistoryEntry::Files` 写回逻辑。
- 改语言文案时，中文和英文都要补齐。
- 改 Tauri 命令或事件名时，要同步更新 `src/services/ipc/*`、`src/lib/tauri.ts` facade 和 Rust `generate_handler!`。
- 新增 eager 主窗口时更新 `tauri.conf.json`；新增辅助窗口时更新 `AUXILIARY_WINDOW_DESCRIPTORS`、前后端 label/type/route、listener ready 协议、两个 capability 文件和 AGENTS 代码地图。
- 新增 Tauri API 时，同步检查 `src-tauri/capabilities/default.json`。
- 发布前至少跑 `npm run check`、`node --test tests/*.test.mjs`、Windows target check、`npm run site:test`、`npm run site:build` 和 `git diff --check`。

## 当前已知限制

- macOS 剪贴板监听仍是轮询，但只轮询 `NSPasteboard.changeCount`，变化后才读取完整内容。
- macOS 未 notarize，GitHub 下载后可能需要手动解除 quarantine。
- Windows 未签名，可能触发 SmartScreen。
- 当前没有云同步，历史只保存在本机。
