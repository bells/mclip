# Pin 限制与显示验证

日期：2026-09-08。源码版本仍为 0.1.1；本记录对应当前工作区，不表示功能已进入公开安装包。实现和自动化完成，三平台原生验收保留未完成。

## 实现与契约

- Rust/TS 共用扁平 `maxPinnedItems`，默认 10、范围 5..=20。历史页有效输入立即进入现有串行保存队列，失败回滚；降低上限保留已有 pins。
- `PinMutationError::PinLimitReached { current, max }` 在实际 mutation 内检查。重复显式 pin 幂等，Unpin 不受 cap 阻拦；桌面进程内并发不会突破同一 cap。
- Tauri command `toggle_history_item_pinned(app_handle: AppHandle, id: String) -> Result<Option<HistoryChange>, HistoryCommandError>` 对应 `invoke<HistoryChange | null>("toggle_history_item_pinned", { id })`。成功 delta 不变；限制错误保留 code/message 并增加 current/max。
- preview/detail 通过 `pin-failure` 定向发送安全 code/counts 到 main；viewer 在自身显示。共享 hook 捕获拒绝、去重 pending、丢弃失效或隐藏窗口的迟到错误，事件和 hook 卸载时清理。不新增窗口或文件读取权限；生成的 ACL 确认 `core:window:default` 包含 `allow-is-visible`。
- 主列表 pins 为被动图标，普通项独立编号；数字 1–9/0 走原有复制路径，CLI index 仍包含 pins。
- CLI 保留 `pin --id/--index`，相邻 `settings.json` 缺失取默认、损坏安全报错。旧 `list --json` 仍为数组；`list --json --with-meta` 为 `{meta:{pinnedCount,maxPinnedItems},data}`，计数在过滤前，data 沿用敏感遮罩和三种条目类型。

## 自动化结果

| 命令 | 实际结果 |
| --- | --- |
| `pnpm run check` | 通过：前端 build、Rust fmt/test/check/clippy；222 Rust 单元测试通过，1 个原有 benchmark 忽略；21 CLI 集成、9 CLI 安装测试通过。 |
| `node --test tests/*.test.mjs` | 216/216 通过；包括设置 normalize、普通编号、数字选择、pending/失效/隐藏错误和保存队列回滚。 |
| `pnpm run cli:test` | 21/21 真实二进制集成测试通过，使用临时合成历史与相邻设置。 |
| `pnpm run site:test` | 16/16 通过；三语旧 100 上限断言已改为默认 10、5–20 和 metadata 示例。 |
| `pnpm run site:build` | 通过，生成六个页面。 |
| `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets` | 通过，3.81 秒；仅 Windows x64 源码编译证据。 |
| `openspec validate --all --strict --no-interactive` | 25/25 通过。 |
| `git diff --check` | 通过；新增文本文件也独立检查空白。 |

Rust fixtures 覆盖 cap=5/10/20、默认第 11 次失败、Unpin 后再 Pin、并发 9/10 竞争、失败不写文件或增加 revision、100 旧 pins 和图片资源保留；CLI fixtures 还覆盖超限幂等、全局计数、过滤、旧 JSON、mask/reveal、损坏配置及非法参数。测试不读取或修改真实剪贴板历史。

## 浏览器合成 IPC 验收

使用真实 React/Tailwind/Sonner 页面、Chromium 和 [browser-fixture.mjs](evidence/browser-fixture.mjs)，用合成 `__TAURI_INTERNALS__` 与 BroadcastChannel 代替 Tauri；**不是原生桌面或实际系统复制证据**。

- 历史页搜索定位/自动聚焦、默认 10、保存 5/20、空值和小数不提交、4/21 失焦修正、失败回滚及错误反馈通过。
- 中英日设置搜索、三语最高 cap 提示（只建议取消）、安全通用错误回退、live region 通过；浅色/深色截图已人工查看。
- 主列表三类 pin 标识、隐藏普通数字后标识仍保留；文本/文件 28px、图片 64px 行高通过。
- 搜索框输入数字不复制；数字 1 调用 `copy_history_item` 指向首个普通 ID；方向键遍历 pins→普通→分组→footer，Enter 可复制 pin。
- 20 pins、320×450 视口可滚动访问普通行；320×650 提示换行且不越界。
- preview 和 preview-detail 每次失败仅定向发 main，viewer 仅发自身；重复错误保持单条，提示不转移焦点，无默认 Toast 热键。配置时长 6000ms，浏览器检查 5.5 秒仍在、随后自动移除。
- mock 生命周期测试覆盖关闭/失效、visibility 查询期间失效、事件目标消失，均不重开窗口或留下未处理拒绝。

复现：在仓库根运行 `node openspec/changes/optimize-pin-limits-and-display/evidence/browser-fixture.mjs`，浏览器访问 `http://127.0.0.1:1474/?window=main`。可用 `window=preferences|preview|preview-detail|image-viewer`、`lang=zhCn|en|ja`、`theme=light|dark`、`pins=20`、`mixed`、`save=fail`。`evidence/browser-*.js` 是 Playwright CLI `run-code --filename` 函数脚本；preferences/main/routing 脚本按其起始页面运行，截图输出到 `/tmp`。

代表截图：[浅色提示](evidence/toast-light.png)、[深色提示](evidence/toast-dark.png)、[历史设置](evidence/preferences.png)、[英文](evidence/en-dark.png)、[日文](evidence/ja-dark.png)、[小屏滚动](evidence/small-screen.png)。全部只含合成数据。

验收脚本修正记录：初始 fixture 漏记 `copy_history_item`、复用了 displayText/renderId、缺少 preview position 响应、图片响应误带 data URL 前缀，均属合成适配层问题；设置 Tab 测试还触发了相邻旧控件保存，改为直接 blur 隔离测试。最早一次 locale notice 早于主列表就绪而丢失，改为等待列表与绘制。旧控制台中的 favicon 404 和这些 fixture 错误不能作为产品运行结果。

## Toast 选型

选择 [Sonner](https://github.com/emilkowalski/sonner) 2.0.8（MIT），复用其队列、live region 和生命周期。实施时 npm registry 查询确认版本及近期维护信息，安装包 peerDependencies 明确接受 React/React DOM 18/19。未加入额外图标包，仍复用现有 PinIcon。当前 build 的共享 PinToastHost chunk 为 35.60 kB，gzip 10.32 kB（含共享代码，不是纯库增量）。

源代码确认空 `hotkey=[]` 受 `hotkey.length > 0` 保护；关闭 close button/swipe/自动交互，采用固定 Toast ID 和主题 token。React 复核涵盖 hook 稳定实例、pending 生命周期、事件订阅清理、unknown 收窄与可访问标签；没有引入网络请求或全历史广播。

## 原生待验收与回滚

任务 7.1、7.3、7.4 保持未勾选。本轮未执行 macOS 安装包逐场景 smoke，没有 Windows/Linux 原生会话证据。Windows cross-check 不替代 WebView2、焦点、鼠标命中、粘贴或输入法验证。

原生复现步骤：准备 11 个合成项，默认连续 Pin 10 个，第 11 个在单条详情、分组详情和 viewer 分别检查提示/焦点；Unpin 后再 Pin。保存上限 5 和 20，确认旧 pins 保留、失败回滚和 20/20 文案。三语及系统/浅/深主题检查主列表、数字输入、编辑/IME/修饰键排除、方向键、0、20 pins 小屏滚动。CLI 在临时 history/settings 中核对 metadata、stderr/exit、幂等。Linux 必须记录 X11/Wayland、桌面环境和能力降级。

回滚到已支持旧 pin 元数据的代码可能忽略新设置并恢复固定 100 的新增限制；旧代码再保存 settings 可能丢掉字段，重新升级使用默认 10。回滚到不认识 pin 的早期 v0.1.1 时会丢失保留保护，降级前备份 history.json 和 history-assets。现有 CLI/桌面多进程文件写入没有新增全局事务锁，本轮不承诺跨进程线性一致。

未修改产品版本、发布 tag、Draft 或远端资产；未提交、推送、同步主规格或归档。旧 change 与 `prepare-v0-2-0-release` 的任务状态保持原样。冲突消解交付见 [reconciliation.md](reconciliation.md)。
