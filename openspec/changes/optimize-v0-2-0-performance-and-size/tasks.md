## 1. 第一阶段：构建配置与体积基线

- [x] 1.1 核实 Cargo/feature/前端/bundle 结构与既有优化，交付本轮审计记录。
- [x] 1.2 使用同机同锁文件重新构建基线桌面和 CLI，保存可执行文件、app 文件清单和字节数；DMG 成功时记录实际体积，失败时记录原因。
- [x] 1.3 实施 Release profile，比较 s/z 候选并选择有实测收益的配置，保留 default-run 和原有平台能力；以 release 构建及产物比较验证。
- [x] 1.4 显式固定 Vite 压缩/source-map 策略并检查 Tauri 包内文件，构建后确认无 map、无意外静态目录并记录前端大小。
- [x] 1.5 执行 pnpm run check、node --test tests/*.test.mjs 和 release CLI help/version/纯变换 smoke，分别记录结果。
- [x] 1.6 交付 performance/ 第一阶段报告并更新 OpenSpec 索引；通过 strict 全量校验与 git diff --check，列出目标差距和原生待验事项。

## 2. 第二阶段：Rust 热点与结构

- [x] 2.1 用合成 fixture 测量分类、搜索、去重、序列化、文本变换的耗时与分配热点，交付基线和候选排序。
- [x] 2.2 评估 CLI/共享领域模块/桌面 adapter 的依赖边界，结合 target feature 图、链接和现有尺寸实验评估拆分必要性，记录采用或不采用理由。
- [x] 2.3 逐项实施有证据的分配或依赖优化，保留 LazyLock 与现有数据/IPC/CLI 契约；通过敏感 fixture、UTF-8/边界及 CLI 回归验证。
- [x] 2.4 同输入重复测量优化后热点，报告收益/噪声；运行 Rust gate，未改善的候选回退并记录理由。

## 3. 第三阶段：前端资源与渲染

- [x] 3.1 扩展 bundle 分析覆盖七路由及全部资源 raw/gzip 字节、重复和 map 检查，用当前 dist 验证输出。
- [x] 3.2 评估约 913 KB 应用图标及其它资源，按实际显示尺寸优化候选；复用已有 256px 图标，对比产物大小与浏览器深浅背景/DPR2 视觉；原生 HiDPI 验收留 4.2。
- [x] 3.3 使用 10/50/500 条混合类型合成历史测量搜索、列表 DOM、选中行重绘与窗口高度，交付渲染基线。
- [x] 3.4 仅针对实测瓶颈优化稳定回调/memo/必要的虚拟化，运行浏览器 pointer/focus/Enter 与高度检查，以及键盘、revision 连续性、即时保存、preview 生命周期的 Node 回归；原生滚动/窗口验收留第四阶段。
- [x] 3.5 对比前端资源和交互结果，通过 build、相关 Node 回归，记录所有不采用的候选与原因。

## 4. 综合验证与原生证据

- [x] 4.1 使用最终配置重新运行 pnpm run check、Node、OpenSpec strict 与差异检查，发布文案若变更则补 site:test/site:build；汇总自动化证据。
- [ ] 4.2 macOS 在隔离合成数据下完成至少五次冷/热启动与交互测量、idle CPU/进程家族 RSS、七窗口和安装包 smoke；明确 panic/诊断边界。
- [ ] 4.3 完成 Windows target source check、原生打包/CLI/窗口/文件剪贴板/性能验证，分开报告两类证据。
- [ ] 4.4 完成 Linux x64 构建与命名桌面会话验证，复用 Linux change 边界，不从 macOS 推断 Linux 支持。
- [x] 4.5 汇总体积目标是否达到及性能数据，不覆盖历史报告；交付剩余事项供 prepare-v0-2-0-release 使用，不自动发布或归档。

2026-09-11 自动化、资源与打包证据见 [第二、三阶段报告](../../../performance/v0.2.0-performance-phase-2-3.md)。4.2–4.4 保持原生/平台验收待办；本轮未执行这些平台的完整运行时协议。
