## Why

v0.2.0 功能基本就绪，需要在保持现有桌面和 CLI 行为的前提下，减少分发体积并改善可测量的运行开销。用户观察到 macOS 安装包约 10 MB，希望接近 3–5 MB；此数字先作为同架构 DMG 的探索目标，不以减少功能或未经测量的承诺换取达标。

## What Changes

- 第一阶段：为实际存在的 `src-tauri/Cargo.toml` 设置尺寸优先的 Release profile；同机、同锁文件、同架构构建前后桌面可执行文件、CLI、`.app` 和 DMG，记录字节数和构建条件。
- 审计依赖 feature、前端压缩及 Tauri bundle 资源，先保留系统剪贴板、TLS、图像格式和窗口能力。只在有收益和兼容性证据时裁剪。
- 第二阶段：依据热点和依赖图评估共享 Rust 模块、CLI 对桌面库的耦合、字符串分配与轮询开销；按可验证的小步重构。现有正则已用 `LazyLock<Regex>` 缓存，不重复改造。
- 第三阶段：测量七个窗口路由、全部 JS/CSS/图片资源及大列表渲染；按测量结果优化资源和行级渲染。虚拟列表、防抖和新增依赖均不是默认措施。
- 第四阶段：汇总自动化、打包和原生性能证据，记录未达目标原因及后续优先级。

## Capabilities

### New Capabilities

无。此 change 是保留行为的构建优化、内部重构和测量工作，使用 `skip_specs: true`，不制造产品能力规格。

### Modified Capabilities

无。保留既有规格；如果后续方案需要改变用户行为，先补充相应 delta 再实施。

## Impact

- 当前只有 Cargo 包 `mclip`，库名 `m_clip_lib`，两个 binary 为 `mclip` 与 `mclip-cli`；不存在 Gemini 文案中的三个独立 crate。前端位于 `src/`，官网独立位于 `site/`。
- 第一阶段涉及 Cargo/Vite 配置、`performance/` 证据和 OpenSpec 索引。后续候选包括 `agent_cli.rs`、`clipboard.rs`、`history.rs`、`sensitive_content.rs`、相关 hooks/list 组件及资源分析脚本。
- 不变更 IPC、历史/设置格式、隐私规则、公开 CLI schema、窗口数量、数据上限、签名策略或产品版本。不使用 UPX、不移除功能、不上传用户数据、不自动拆分 workspace。
- 继承 `optimize-v0-1-1-runtime-performance` 的懒加载窗口、revision delta、图片缓存约束；配合 `refine-v0-2-0-interface`、`optimize-pin-limits-and-display`、`add-linux-desktop-support`，不替这些 change 完成原生验收。
- `prepare-v0-2-0-release` 继续独立管理发布；第一阶段已按用户要求本地提交为 `735f707`；随后授权实施第二、三阶段，结果见 [阶段报告](../../../performance/v0.2.0-performance-phase-2-3.md)。后两阶段暂未提交，不归档、改 tag 或发布。
