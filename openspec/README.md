# OpenSpec 项目索引 / Project Index

核对日期 / Reviewed: 2026-09-07。当前源码版本为 `0.1.1`，多个面向 `0.2.0` 的功能已经进入实现。本文提供规格与验收入口，不证明某个 Release 已发布，也不替代各 change 的任务和验证记录。

The source version is still `0.1.1`, with subsequent features already implemented. This index separates specification, implementation, and delivery evidence; it does not certify a published release.

## 阅读顺序 / Reading Order

1. [PRODUCT.md](../PRODUCT.md)：当前产品行为和支持边界 / product behavior and support boundaries.
2. [AGENTS.md](../AGENTS.md)：维护约束、代码地图、命令 / implementation rules, code map, and commands.
3. [project.md](project.md) 与 [config.yaml](config.yaml)：完整架构上下文与新产物的简明约定 / expanded context and artifact rules.
4. [specs/](specs/)：已经同步的规格基线 / synchronized specification baseline.
5. 对应 `changes/<name>/` 的 proposal、design、delta specs、tasks 和 verification：变更意图、实现进度与验收证据 / intended changes, implementation progress, and evidence.
6. [memory.md](../memory.md)：决策理由和历史故障，当前事实需核对代码与日期 / decision history, with current facts checked against code and dated records.

CodeGraph 可用于追踪源代码符号、调用关系与影响范围；结构索引、测试关联和源码阅读都不能代替执行验证。配置和 Markdown 文档直接阅读。不要把未找到测试关联解读为没有测试。

Use CodeGraph for source structure and call paths when available. Read configuration and Markdown directly. Graph test links are not coverage reports or runtime verification.

## 规格与状态 / Specs And Status

主规格目前包含 `appearance-settings`、`history-display`、`dialog-window-chrome`、`cli-distribution`。它们是已同步基线，不能单独代表当前代码的全部能力。置顶、隐私、文本操作、设置中心、Linux、日语、运行时性能和原生应用选择等能力，还需要结合下表中的 delta specs 阅读。

Main specs currently cover four synchronized capabilities. Read active deltas as well for subsequent implemented behavior. A checked task list, synchronized spec, archived change, and released artifact are distinct states. In particular, `complete` from `openspec list` describes task checkboxes, not universal native support.

以下进度是核对日期的快照；继续工作前运行 `openspec list --json` 并读取原始任务。文档对齐不会自动勾选、归档或发布。

The following is a dated snapshot. Refresh it from the CLI and source task lists before continuing work; documentation alignment does not complete, archive, or publish changes.

| Change / 任务入口 | 完成 / Total | 待核实事项 / Evidence boundary |
| --- | --- | --- |
| [select-ignored-source-apps](changes/select-ignored-source-apps/tasks.md) | 6/6 | 清单完成；Windows/Linux 原生选择与运行时仍待验证，详见 verification |
| [modernize-node-pnpm-toolchain](changes/modernize-node-pnpm-toolchain/tasks.md) | 14/14 | 清单完成，尚未归档 |
| [refine-preferences-theme-and-image-viewer](changes/refine-preferences-theme-and-image-viewer/tasks.md) | 21/21 | 清单完成，尚未归档；不自动关闭旧 viewer change 的验收任务 |
| [sync-main-window-navigation-highlight](changes/sync-main-window-navigation-highlight/tasks.md) | 16/16 | 清单完成，尚未归档 |
| [optimize-history-preview-layout](changes/optimize-history-preview-layout/tasks.md) | 21/21 | 清单完成，尚未归档 |
| [add-main-brand-visibility-setting](changes/add-main-brand-visibility-setting/tasks.md) | 17/17 | 清单完成，尚未归档 |
| [refine-menu-bar-notebook-m-icon](changes/refine-menu-bar-notebook-m-icon/tasks.md) | 8/10 | macOS/Windows 菜单栏与托盘原生视觉验证 |
| [add-japanese-localization](changes/add-japanese-localization/tasks.md) | 29/31 | change 对应的 Windows 检查与七窗口日语原生验收 |
| [add-linux-desktop-support](changes/add-linux-desktop-support/tasks.md) | 28/34 | signature-first polling 尚未完成；原生会话、打包安装、CLI ownership 及公开声明验收 |
| [optimize-preferences-settings-center](changes/optimize-preferences-settings-center/tasks.md) | 36/38 | macOS/Windows 完整设置中心 smoke |
| [add-text-quick-actions-and-pipelines](changes/add-text-quick-actions-and-pipelines/tasks.md) | 28/29 | macOS 原生操作与管道 smoke，保留其它平台边界 |
| [add-sensitive-content-protection](changes/add-sensitive-content-protection/tasks.md) | 30/32 | macOS/Windows 遮罩与来源排除、X11/Wayland 能力证据 |
| [add-pinned-history-items](changes/add-pinned-history-items/tasks.md) | 29/30 | macOS 安装包的置顶完整行为 smoke |
| [optimize-v0-1-1-runtime-performance](changes/optimize-v0-1-1-runtime-performance/tasks.md) | 39/41 | 精确 macOS 跨窗口路径与 Windows 性能/原生协议 |
| [add-fullscreen-image-viewer](changes/add-fullscreen-image-viewer/tasks.md) | 13/16 | 历史 change 中自动化及两平台原生验收仍未勾选，需核对后续证据 |
| [optimize-v0-1-1-experience](changes/optimize-v0-1-1-experience/tasks.md) | 20/23 | 以原始清单中的剩余验证任务为准 |
| [add-cli-version-and-update-management](changes/add-cli-version-and-update-management/tasks.md) | 29/32 | Windows 检查、Preferences CLI 状态矩阵、同一 Draft 下载校验 |
| [introduce-tailwind-ui-refactor](changes/introduce-tailwind-ui-refactor/tasks.md) | 26/27 | 原生窗口深浅色视觉 smoke |
| [prepare-v0-2-0-release](changes/prepare-v0-2-0-release/tasks.md) | 0/35 | 前置、迁移、版本、打包原生验收与发布资产门禁仍开放 |

## 证据沿用 / Reusing Evidence

- [2026-09-05 ignored-app verification](changes/select-ignored-source-apps/verification.md) 记录了 macOS 全套自动化、mock IPC 浏览器验证、本地 AppKit 元数据检查，以及 cargo-xwin Windows x64 all-target 检查通过。Windows SDK 缺少 `assert.h` 是更早的普通交叉检查障碍，已由该工具链解决；Windows 原生行为仍未因此得到证明。
- 同一记录中，macOS smoke 来自负责人的整体反馈，没有逐场景矩阵；Windows Parallels 与 Linux 原生验证仍待完成。不能把该记录直接换算为所有旧 change 的验收通过。
- [v0.1.1 performance report](../performance/final-v0.1.1-runtime-performance.md) 的数值是记录时 Apple M2/macOS 协议的结果，不是后来每个提交或其它平台的性能保证。
- 归档目录和已完成的历史测试记录保留当时命令与日期。新执行使用当前 Node/pnpm/cargo-xwin 工具链；未完成任务如果沿用旧证据，必须核对范围、提交及受后续修改影响的路径。

Reuse dated evidence only after checking its commit, scenario scope, and later changes. Mocked browser IPC, cross-compilation, owner-reported smoke, and a full native scenario matrix must remain distinguishable.

## 当前验证命令 / Current Commands

```bash
openspec list --json
openspec validate --all --strict --no-interactive
pnpm run check
node --test tests/*.test.mjs
pnpm run site:test
pnpm run site:build
git diff --check
```

On macOS, with LLVM, the Rust Windows target, and cargo-xwin installed:

```bash
XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets
```

Linux 安装包与会话协议见 [Linux support](../docs/linux-support.md)。发布前还需实际验证迁移、安装包、各平台运行和同一 Draft 的资产、checksum 与版本。当前 Release workflow 会校验各 runner 本地产生的 CLI，不等于已经实现或执行完整的同一 Draft 下载矩阵。

Release readiness additionally requires migration, packaged native behavior, and same-Draft asset/checksum/version verification. Preserve explicit release-owner authorization for tag pushes, Draft publication, and remote asset replacement.

本轮界面调整见 [refine-v0-2-0-interface](changes/refine-v0-2-0-interface/verification.md)：托盘偏好设置入口、外观归类、转换布局与主题状态。实施和验证记录独立于原生验收；旧 delta 的归类冲突按该 change 的 design 协调表在后续显式 sync 时处理。
