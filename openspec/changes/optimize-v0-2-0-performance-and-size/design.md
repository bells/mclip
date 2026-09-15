## Context

动机见 [proposal.md](proposal.md)。2026-09-10 检查：单 Cargo 包导出 `staticlib/cdylib/rlib`，CLI 入口调用 `m_clip_lib::agent_cli::run_from_env()`。无 release profile；Tauri CLI 的生产构建与普通 `cargo build` 环境有区别，桌面基线必须使用相同 Tauri 打包命令。

`reqwest` 已关闭默认 feature、使用 Rustls；`image` 直接 feature 为 PNG/JPEG，但统一 feature 图还包含 Tauri 的 ICO/BMP 和 arboard 的 TIFF。Tokio 是 Tauri/HTTP 的传递依赖，无直接 `tokio/full` 声明。敏感检测四个正则均为 `LazyLock<Regex>`。Vite 7 默认 esbuild 压缩且无 source map；bundle 未声明额外 resources。前端现有约 913 KB `app-icon.png`，七路由动态导入；现有 bundle 分析器只统计六路由且资源只有名称，是后续测量缺口。

## Goals / Non-Goals

**Goals:**

- 用字节数区分 Mach-O、CLI、app 文件逻辑总量、DMG 压缩量、前端 raw/gzip，建立能复现的比较。
- 第一阶段独立检验编译策略收益；后续按热点、资源占比和依赖证据排序。
- 优化不改变现有数据、命令、IPC 与用户操作语义。

**Non-Goals:**

- 不将 3–5 MB 作为牺牲图像、TLS、平台能力或隐私语义的硬约束，不用 UPX 或不稳定 `build-std`。
- 不为概念名称先拆三个 crate，不将所有 clone 改成借用，也不默认引入虚拟列表库或防抖。

## Decisions

### 1. 比较 Release 策略，而非猜测 z 一定更小

先保存当前配置基线，再评估 `opt-level = "s"`、`lto = true`、`codegen-units = 1`、`strip = true`、`panic = "abort"`；对 `z` 做同输入候选构建。选取本机实测的尺寸结果，同时把吞吐和原生启动验收留作独立检查。`z` 禁用某些向量化等优化，不保证对本项目更小或更快。保持 dev/test 默认调试体验，不改变 crate-type 和 `default-run`。

`panic = "abort"` 影响异常路径：panic hook 仍可执行，但 panic 后进程退出、不展开栈、没有析构清理或线程级 panic 恢复。正常错误继续走 Result。先查应用是否依赖 catch_unwind；测试 harness 的 unwind 结果不作为 release abort 行为证明。后续原生验收包含出错路径，必要时回退此单项策略。

第一阶段实测后采用 **z**：相同资源、签名和包内容下，DMG 基线 12,865,668 bytes，s 为 9,258,208，z 为 8,906,629。尚未达到 3–5 MB，CPU/RSS/启动收益也未测得；完整证据见 [体积报告](../../../performance/v0.2.0-size-phase-1.md)。此选择是当前尺寸结果，不表示吞吐已验收。

### 2. 固定可比构建条件

记录 commit、dirty scope、锁文件摘要、rustc/LLVM、Node/pnpm、macOS、架构、命令、签名策略、产物 SHA-256。候选桌面使用 `pnpm run tauri:build --no-bundle -- --locked`，CLI 使用 `cargo build --locked --manifest-path src-tauri/Cargo.toml --release --bin mclip-cli`，最后 `pnpm exec tauri bundle --bundles app,dmg --ci`。若平台环境无法创建 DMG，仍完成 binary/app 比较并明确 DMG 缺证，绝不用 app 大小代替 DMG。实际基线命令和失败重试见体积报告。

前后样本存入 ignored target 内的独立目录，报告写入 `performance/`。测量 `.app` 采用常规文件逻辑字节总和，不与 `du` 文件系统占用混用。历史 10 MB 只作为用户观察，不作为本次基线。不启动连接真实历史的桌面实例做性能实验。

### 3. 裁剪依赖前先验证平台用途

第一阶段仅配置 profile，显式固定 Vite `minify: "esbuild"`、`sourcemap: false`，不会虚报现有默认行为为新增收益。保留构建 manifest 供测量。审计 Tauri 打包文件；官网不在 frontendDist 内。重复版本可能属于 build/proc-macro，不等于最终二进制重复；不强行降级或 patch 传递依赖。Serde std、Tauri runtime/compression、arboard 图像和 Rustls 不能机械关闭。

后续优先研究：真实 app 图标按显示尺寸派生并保持视觉；CLI 领域逻辑和平台 adapter 的依赖边界；可证明无用的 feature。保留原图归属，不 mass regenerate 图标。剪贴板数据和图片内容不能进入性能日志。

### 4. 核心和 React 优化由基线驱动

Rust 测量固定合成 fixture 的分类、搜索、序列化、去重和文本转换；减少热点中可避免的分配，保留线程所有权边界、UTF-8 截断、1 MiB 输入/4 MiB 输出、64 KiB 检测限制。现有 LazyLock 保留。Linux signature-first polling 由原 change 管理，不能仅从 macOS 验证宣称完成。

前端先补七路由与资源字节统计。默认主列表 10、分组 50，配置最大主列表可达 1000 普通项加保留置顶；用混合高度合成数据测量渲染、搜索和键盘/hover。只有有证据时引入 memo、稳定 callback 或成熟虚拟列表库；虚拟化必须保留动态行高、data-preview-item-id、滚动定位和实测窗口高度。不对 revision delta 做丢事件的 debounce，不延迟即时保存。

### 5. 验证分层

第一阶段执行构建、CLI release help/version/纯变换、现有 Rust/Node 自动化门禁及 OpenSpec strict 校验。后续记录隔离合成 fixture 下 idle CPU、进程家族 RSS（包含 WebView 子进程）、冷启动、窗口重复打开、搜索 p50/p95；同硬件/同数据至少五次，报告 median/p95 与噪声，不从二进制下降推断内存下降。

macOS GUI 留原生 smoke 项；Windows source check 和 Windows runtime 分开；Linux 按 X11/XWayland/命名 Wayland 会话分别留项。网站无公开文案变更时不重复运行 site gate。此 change 未完成前不覆盖旧性能报告或发布验收清单。

## Risks / Trade-offs

- [LTO 与单 codegen unit 增加编译耗时/峰值内存] → 记录耗时但不把增量缓存耗时当公平编译性能基准；只影响 Release。
- [abort 改变 panic 恢复语义、strip 降低符号诊断能力] → 明确退出边界、保留正常错误处理，后续原生验证；可单项回退。
- [3–5 MB 未必可达] → 报告实际压缩瓶颈，优先资源与依赖，保留功能。
- [不同平台 feature 统一掩盖裁剪效果] → 针对 target 的 feature 图与构建验证，不能凭 manifest 猜测收益。
- [虚拟化破坏窗口定位和 hover] → 默认保留现有分组与边界，先测后选。

## Migration Plan

无数据迁移。第一阶段已提交 `735f707`，第二、三阶段已获授权并实施。配置改动可独立还原；基线保留在 ignored target，证据保留版本化报告。后续阶段独立实施与验收，发布仍走原有流程。

## 第二、三阶段落地（2026-09-11）

- CLI 用借用/Cow 保留普通与 reveal 记录，只有敏感展示才复制并遮罩；SHA-256 直接格式化摘要。LazyLock、轮询平台策略、历史与输出契约保持。
- 复用已有 256px 图标替换前端和 Rust 托盘的 1024px 内嵌原图；保留 root 原图与原生 ICNS。深浅背景/DPR2 浏览器对比通过，原生托盘 HiDPI 留 4.2。
- 文本展示先限制长度再分配 code-point 数组，memo 只用于 primitive props 的 HistoryListText。搜索先筛选再装饰，跨字段含空格查询保留原拼接语义。500 行选中更新合成中位数 61.4 → 2.1 ms，暂不引入虚拟列表或 debounce。
- CLI 独立产物仍为 1,667,248 bytes，系统 AppKit/WebKit 是动态链接。共享持久化/剪贴板尚有 adapter 耦合，未做拆分原型，现有证据不足以证明拆 workspace 的尺寸收益，暂保留单包。图像格式和传递运行时 feature 有实际用途，不机械裁剪。
- 最终 DMG 7,215,130 bytes，未达到 3–5 MB。完整方法、分配与时间样本、未采用候选和原生边界见 [报告](../../../performance/v0.2.0-performance-phase-2-3.md)。

## 运行时扩展设计（2026-09-13）

用户追加启动、运行中以及各个页面的响应速度。新增 history-display/runtime-performance delta；移除 skip_specs。默认 200、保留范围 10..=1000、既有设置不迁移、置顶另计（历史兼容 100 置顶的总量断言随上限派生）。旧报告中的 500 条结果不改写。

### 审计结论与本轮选择

1. 启动已是单 main WebView、按路由导入、设置加载与窗口配置并行、托盘 ready 后预热两个 preview。首次仓储读取仍立即重读刚解析过的文件计算指纹；移除此重复检查，并去掉只读快照的 unused previous snapshot。保留后台 I/O 和 ready generation，不以延迟预热让指标虚假变快。
2. 常驻复制/单条查询在查找前克隆完整历史；改为持锁完成外部 reconciliation、借用遍历、只克隆命中项。保留 mutation 的前后快照，避免破坏 revision delta、持久化失败与广播语义。
3. `history_file_fingerprint` 每次读整文件并分配等大字节数组；改为固定 64 KiB 分块 SHA-256，仍检测相同长度内容变化。release 单独把 sha2 从 z 调至 3；保留其它依赖 z，用同 fixture 比较耗时。不会只凭 mtime/size 跳过校验，这会弱化外部修改检测。
4. 首次快照的遮罩已有 owned entries；在 owned 副本中改写敏感字段，不重新克隆普通条目。持久化真相与显式 reveal 不变。
5. macOS 仍 500ms 读 changeCount、变化后等待 settle delay；设置类型只在实际读取时获取，仓储只克隆三个类型开关，避免空闲时克隆 100 个忽略应用标识。Windows 消息监听与 Linux broker 模型保留。
6. 图片已有 32 MiB / 8 MiB single-flight 缓存；同 WebView 共享 in-flight promise。暂不加长期 JS 图片缓存或移除 metadata 校验。上限扩大不扩大缓存预算。
7. 主列表选中已有 text memo；1000 条长文本 profiling 单独记录搜索剩余开销。Preferences 六页保留即时串行保存、回滚和搜索定位；About 设置/版本并行读取，CLI/权限请求不阻塞基础设置渲染。quick-action 继续有界 Rust 转换，preview 请求继续 revision 失效控制。

8. 设置事件仅在隐私遮罩改变时重新读取展示快照，其它设置复用当前历史；保留后端每次保存的外部 reconciliation/裁剪事件。增加 presentation revision，拒绝旧遮罩状态的异步响应，并补读最新状态。

### 七窗口响应协议

| 窗口/页面 | 首次与重复打开 | 页内响应与回归 |
| --- | --- | --- |
| main | 进程启动、托盘 ready、history-ready、第一次可见 paint；驻留后显示 | 空/命中/无命中/跨字段/Unicode 搜索；连续上下键、Enter、主列表数量 10 与 1000；删除/置顶 delta；内容 resize |
| preview 分组/单条 | 首次预热竞争、首次 payload、重复打开的 ready/IPC/native/paint | 分组 5/50/100；动态行高、文本/文件/图片；鼠标从主窗口进入及离开 |
| preview-detail | 分组 hover 请求到 payload/原生位置/绘制 | 连续 hover、跨屏/DPR、详情翻边、关闭过程中旧请求失效；保留组 X |
| image-viewer | 首次冷缓存与命中缓存分别计时，重复打开单列 | 最大化/恢复/Escape/删除；图片 load/error、缓存命中/驱逐和 main 层级恢复 |
| about | 第一次路由+listener+数据到可见内容，保留窗口再次显示 | 系统/浅/深色与语言更新、关闭/拖动；联网检查延迟与本地 UI 分开 |
| preferences | 首次打开与六页 general/appearance/history/privacy/textActions/cli 切换 | 搜索及结果焦点、即时保存 ack/回滚、连续编辑、忽略应用本地元数据、CLI 状态；不执行安装或系统设置操作作为性能测试 |
| quick-action | 第一次创建与再次复用 | JSON/Base64/URL 三类、UTF-8、1 MiB 输入/4 MiB 输出、非法输入；结果可见/关闭；复制/替换为独立授权回归 |

用 0/10/50/500/1000 普通条目及额外置顶数据；冷进程至少 5 次，声明文件系统缓存是否已热；首次操作不混入热统计，交互预热 5 次再收 20 次。按同一时钟和 interaction id 配对，不跨时钟相减。报告 median/p95、样本、失败数与硬件/build/锁文件摘要。候选目标为改善其热点 median 至少 15%，p95 不回退超过 10%；噪声或未达目标须说明，不用绝对帧预算取代回归。1000 条恶劣长文本不得只给平均值，也不得用纯过滤耗时代替键入到绘制。

### 原生资源与测量隔离

记录启动后 main 隐藏、main 显示、七窗口曾打开后全部隐藏、持续复制/搜索/图片操作四种驻留状态，每种至少 60 秒；CPU 使用区间差值，RSS 分开列主进程与能归属的 WebView/WebKit/网络/GPU 进程。无法可靠归属的共享进程标记不可归属，不累计整个浏览器进程家族冒充 mclip。

旧 fixture 仅隔离 settings/history，仍会启动系统 watcher。现在显式性能模式且临时配置验证通过的 fixture 运行不启动 watcher；第二实例与退出 launcher 保留相同隔离环境。此模式可以测启动/窗口/历史与图片，但其 idle CPU 不能证明生产剪贴板 watcher 的 CPU，后者需要专用测试用户/桌面会话中使用合成系统剪贴板测量。fixture 模式还跳过真实登录启动项的读取/修改，允许测量设置保存而不改变系统自启。用户日常数据不得用于性能实验。Windows/Linux 的原生结果分别保持待办，不依赖 macOS 推论。

详见 [本轮证据](../../../performance/v0.2.0-runtime-response.md)。
