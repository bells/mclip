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

前端先补七路由与资源字节统计。默认主列表 10、分组 50，配置最大主列表可达 500 普通项加保留置顶；用混合高度合成数据测量渲染、搜索和键盘/hover。只有有证据时引入 memo、稳定 callback 或成熟虚拟列表库；虚拟化必须保留动态行高、data-preview-item-id、滚动定位和实测窗口高度。不对 revision delta 做丢事件的 debounce，不延迟即时保存。

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

无数据迁移。先生成提案和清单，再依用户当前要求实施第一阶段。配置改动可独立还原；基线保留在 ignored target，证据保留版本化报告。后续阶段独立实施与验收，发布仍走原有流程。
