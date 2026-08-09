## Context

mclip v0.1.1 的真实实现已经超过归档版本最初记录的五窗口模型：`tauri.conf.json` 目前预声明 `main`、`preview`、`preview-detail`、`image-viewer`、`about`、`preferences` 六个窗口，每个 WebView 都加载 `src/main.tsx -> App.tsx`，再由运行时 label 选择组件。`App.tsx` 静态导入所有窗口组件，当前生产构建因此生成一个 326.74 kB（gzip 99.79 kB）的 JavaScript chunk 和一个 33.15 kB（gzip 6.89 kB）的 CSS chunk。应用启动时即使六个窗口全部隐藏，也会创建六个 WebView 并解析同一入口。

主窗口挂载后并行调用 `get_settings` 与 `get_history`，这是正确的前端并行边界，但两个 Rust command 都同步读盘；`build_tray` 又独立读取一次设置。桌面历史操作和剪贴板 watcher 每次从 `history.json` 全量读取/解析，写入后通过全局 `history-updated` 事件复制整个数组。主窗口需要完整内容，preview 窗口实际只用 id 集合做 reconciliation，About、Preferences 与 viewer 不需要该 payload。

图片路径的每个 `ImageThumb` 挂载都会调用 `get_image_base64`；Rust 每次重新 `read` 并 base64 编码。preview、preview-detail 与 `image-viewer` 属于不同 WebView，JavaScript 内存不能共享，所以同一图片从普通详情进入最大化查看器时会重复读盘和编码。当前 viewer 在预声明窗口监听事件后先接收 payload、再执行一串原生窗口操作；这种“图片加载与窗口显示重叠”的优点必须在按需创建窗口后通过就绪协议继续保留。

本设计同时以已归档 `v0.1.1` 和所有尚未归档但已进入真实代码的 change 为约束。preview 家族继续独立、透明、不可聚焦；主窗口继续拥有搜索/键盘/鼠标的 canonical active target；`image-viewer` 继续直接最大化、允许恢复并在打开期间降低 main 的置顶层级；Preferences 继续即时保存。性能重构不得以改变这些行为换取更好的数字。

## Goals / Non-Goals

**Goals:**

- 用同一 release build、固定 fixture 和明确起止里程碑量化冷启动、驻留后主窗口、详情和 viewer 路径，并保留优化前后可比较证据。
- 将启动关键路径从六个完整 WebView 收敛为 main 与原生托盘能力，并让辅助窗口按频率分级预热或首次使用时创建。
- 让每个窗口只下载、解析和执行自身路由及必要共享代码，把主窗口初始 JavaScript gzip 降到 75 KiB 以内。
- 通过桌面端内存仓储、定向增量事件和有界图片 single-flight cache 消除重复同步 I/O、全量广播和重复编码。
- 将产品历史保留默认值设为 200、可配置上限设为 500，并保持前端 normalize、偏好设置输入和 Rust sanitize 的边界完全对称。
- 在同一职责边界内整理 Rust、React/TypeScript 和 CSS：Rust 管理本地状态与原生窗口，React hooks 管理视图状态，IPC 使用显式对称类型，CSS 只做经 profiling 证明有价值的渲染优化。
- 在 macOS 取得真实 release-build 性能与交互证据，并让 Windows CI/真机使用同一测量协议验证平台边界。

**Non-Goals:**

- 不更改历史/设置 JSON 格式、剪贴板读取或文件列表回填语义；已有 10–200 范围内的合法历史条数设置不迁移。
- 不把 preview 放回 main DOM，不让 preview 可聚焦，不改变 pointer polling、定位、request revision 或详情关闭语义。
- 不改变图片查看器功能，不增加缩放、拖动、旋转、编辑、云同步或远程遥测。
- 不以压缩变量名、任意 `memo`、删除可访问性状态、减少错误处理或关闭动画作为优化手段。
- 不为了基准测试读取、上传或记录用户真实剪贴板内容；不在本 change 引入新的运行时依赖。
- 不替用户归档现有 OpenSpec changes；归档顺序由用户稍后统一处理。

## Decisions

### 1. 先建立跨 Rust/前端的里程碑协议，再修改关键路径

新增仅记录事件名、窗口 label、interaction id、持续时间、fixture 规模和成功/失败状态的本地性能记录器。Rust 使用单调时钟记录 `process-entry`、`setup-start`、`tray-ready`、`main-show-request` 和原生窗口完成；前端使用 `performance.now()` 记录 bootstrap、route loaded、listeners ready、history rendered、preview painted、viewer painted 与图片 `load/error`。跨边界不比较两个时钟的绝对值，而是通过 interaction id 分别计算 Rust 段、WebView 段和端到端 command/ack 段。

默认发布运行不持续写详细 trace。测试或手工验证通过显式性能模式启用，并把聚合结果写到 diagnostics 目录；任何 payload 文本、文件路径、图片内容、来源应用名称和搜索词都不得进入记录。fixture 使用临时配置根，覆盖空历史、默认 50 条和上限 200 条混合文本/文件/图片历史，不触碰用户真实配置目录。

每个场景先预热 5 次，再采集至少 20 次，报告 median 与 p95。冷启动单独以全新进程计时，驻留窗口交互在同一进程内采集。macOS 本地 release build 是 apply 阶段的主要真实基线；Windows 使用相同 fixture 和事件定义，但最终数字必须来自 Windows CI artifact 或真机，macOS 不能替代。

只使用 console timing 被否决，因为不同 WebView 日志无法稳定关联且无法覆盖 Rust setup。引入通用 tracing/metrics 依赖也被否决，因为本次只需要小型、本地、默认关闭的性能 seam。

### 2. 将窗口生命周期分成启动、预热和按需三个层级

`tauri.conf.json` 只保留 `main` 作为启动时创建的 WebView。Rust 增加一个以枚举定义精确 label、URL、尺寸、透明度、focusable、resizable、always-on-top 和 skip-taskbar 属性的辅助窗口工厂；capability 继续列出全部固定 label，使动态创建的窗口仍只有原有最小权限。

窗口分级如下：

- 启动层：原生托盘、全局快捷键、clipboard watcher 调度和 `main`。它们完成后立即记录 `tray-ready`，不得等待其它 WebView。
- 预热层：`preview` 与 `preview-detail`。在 `tray-ready` 后的空闲时段创建；如果用户先打开 main，则与 main show 并行确保它们就绪。预热不能阻塞 main 的显示或焦点。
- 按需层：`about`、`preferences`、`image-viewer`。首次动作创建，之后隐藏而不销毁，因此重复打开走热路径。

所有辅助窗口统一执行 ready handshake：前端路由先注册需要的事件监听器，再调用 typed `mark_auxiliary_window_ready`；Rust registry 用 window generation 区分旧实例，合并同一 label 的并发 ensure，并在超时后返回可恢复错误。调用方只有在对应 generation ready 后才发送 payload 和 show，避免当前 `emitTo` 对不存在或尚未监听窗口的丢失风险。`image-viewer` ready 后先发送 payload并启动图片请求，再与原生 show/maximize 并行，继续保留现有加载重叠。

保留六个静态窗口但只拆包被否决，因为 WebView 进程/实例本身仍在冷启动路径。每次关闭都销毁辅助窗口也被否决，因为会恶化重复打开并增加事件生命周期复杂度。启动时只创建 main、永不预热 preview 也被否决，因为详情是高频动作，首次 hover 不应承担完整 WebView 冷创建成本。

### 3. 用窗口路由模块替代一个静态 `App` 依赖图

把入口收敛为小型 bootstrap：读取当前窗口 label、安装诊断边界、动态 import 对应 window root，再挂载 React。`MainWindow`、preview family、viewer、About 与 Preferences 分别成为路由模块；Vite 生成共享基础 chunk 和窗口专属 chunk。主窗口模块不得静态导入 CLI 设置页、About、viewer 或 preview 渲染组件，辅助窗口也不得执行 `useClipboardApp`。

`styles.css` 中跨窗口共享的 reset、语义 token 和基础 frame 保持一个小型公共入口。只有在 Vite manifest 和浏览器 performance trace 证明 CSS 解析/样式计算是瓶颈时，才进一步拆分窗口样式；当前 CSS gzip 仅 6.89 kB，盲目迁移 CSS 会增加维护成本而没有可信收益。Tailwind class 映射继续允许共享，构建测试检查 main 初始请求集合而不是用源文件行数推断性能。

以 `React.memo` 包裹所有组件或将文件机械拆小被否决：当前首要问题是跨窗口静态依赖和 WebView 数量，组件 memo 只有在 React Profiler 显示重复渲染成本后才采用。

### 4. 引入桌面端仓储快照，CLI 继续使用 path-based helpers

Rust 桌面进程管理 `DesktopStateRepository`，包含 sanitized settings、带递增 revision 的 history snapshot 和必要锁。settings 在 setup 中加载一次并同时供 tray 与前端读取；history 在后台或首次请求时加载一次，后续 get、插入、删除、清空和 trim 都在仓储事务中串行化。阻塞文件读取、pretty JSON 序列化和原子写入在非 UI 线程执行；只有持久化成功后才提交内存快照并发事件。

历史文件损坏仍记录错误并回退为空，现有 legacy migration、stable id、去重、裁剪和未使用图片清理函数继续作为纯/path-based core。`mclip-cli` 不依赖 Tauri managed state，继续通过同一 path-based helpers 直接操作文件，保证独立进程和指定 `--history-path` 行为。

全局持有一个可变 `Vec` 而不做 revision 被否决，因为异步 command 和事件可能让前端应用旧结果。每个 mutation/result 携带 revision，前端 reducer 忽略早于当前 revision 的 payload。使用数据库替换 JSON 被否决：最大历史条数扩展到 500 后数据规模仍小，真正问题是重复 I/O 与广播，而不是查询能力。

### 5. 历史更新采用 typed delta，并按窗口定向发送

初始 `get_history_snapshot` 返回完整 entries 与 revision。之后 Rust 发送带 revision 的 `HistoryChange` union：新增/去重移动使用 `upsert` 加必要的 `removedIds`，删除使用 `remove`，清空使用 `clear`，异常恢复才使用 `replace`。主窗口 reducer 在内存中应用 delta并重新计算过滤/分组；command 返回与事件使用同一 revision 规则，避免删除动作和广播造成双重应用。

preview 家族不再接收完整 history；它只接收包含 revision、removed ids 和是否要求关闭当前 preview 的轻量 invalidation。新剪贴板进入、搜索变化和 selection dismissal 继续关闭旧 preview；删除当前 preview 条目时 reconciliation 仍同步清理详情。About、Preferences 与 viewer 不订阅历史数组；viewer 删除由 command 结果和自身关闭路径处理。

继续广播完整 `Vec<HistoryEntry>` 被否决，因为隐藏的 WebView 也要承担 clone、序列化和 React state 更新。只发“已变化”再让每个窗口重新 `get_history` 也被否决，因为会把一次广播变成多次 IPC 和全量序列化。

### 6. 图片读取使用 Rust 有界 single-flight cache，前端共享同 WebView promise

Rust 将图片 key 定义为规范化 app-owned path、文件长度和修改时间（历史 `contentHash` 可作为额外校验），并为同一 key 合并并发 read/base64 工作。成功结果进入按总字节数限制的 LRU；建议初始上限 32 MiB，同时限制单项大小，超过上限的图片只完成当前请求而不驻留。文件删除、metadata 改变、历史资源 cleanup 或读取失败会失效对应项；cache 不写磁盘、不跨进程、不记录内容。

每个 WebView 的 `useImageDataUrl` 再通过模块级 promise registry 合并相同 key 的并发 hook 请求，并在无人使用时只保留小型已完成引用；真正的跨窗口复用由 Rust cache 提供。图片继续通过 typed command 返回，不放入 viewer/preview 事件。若将来验证 asset protocol 在 macOS/Windows 均可靠，可另开 change 评估直接文件 URL；本次不推翻现有兼容性选择。

无界 `HashMap<String, String>` 被否决，因为剪贴板图片可能较大且 base64 会额外膨胀内存。仅做前端 cache 被否决，因为六个 WebView 的 JavaScript heap 相互隔离。

### 7. 精简高频原生窗口转场，但把正确性置于微秒级减少之上

窗口创建时一次性设置 decorations、shadow、focusable、透明度等不变量；重复 show 只执行随显示器或状态变化而必须重算的 frame、position、visibility、maximize 与 focus。About/Preferences 仍在每次显示时居中。viewer 的普通 frame、main always-on-top 降级、maximize、双层 macOS focus 和失败恢复保持既有顺序，只把可证明为重复的不变量移出热路径。

preview 定位继续实时读取当前 main/monitor 几何，`resize_history_preview_window` 继续保留 X，pointer hit testing 与 macOS focus reinforcement 不因 profiling 结果缺失而删除。React 对连续 content-height 或 hover 请求只在 trace 显示重复 IPC 时做同帧合并；不得引入可感知 debounce。

### 8. 性能验收同时使用相对改进、绝对交互预算和功能回归

在同一机器、同一 release build、同一 fixture 下，冷启动 `process-entry -> tray-ready` median 必须较变更前下降至少 20%，p95 不得恶化超过 10%。主窗口驻留热打开 p95 必须不超过 120 ms；已预热的文本/文件详情 shell p95 不超过 120 ms；图片详情 shell p95 不超过 120 ms且重复图片 ready p95 不超过 250 ms；viewer shell 可见并最大化 p95 不超过 250 ms且重复图片 ready p95 不超过 300 ms。Windows 如因 WebView2 首次初始化无法达到 macOS绝对值，必须单独记录冷/热数据并至少满足相对改进与无回退门槛，不能用 macOS 结果代替。

自动化门禁负责 Vite manifest、initial chunk、窗口配置、ready timeout、delta reducer、仓储并发和 image cache；真实时延数字作为 release-build benchmark evidence，不放入易受共享 CI 机器抖动影响的普通单元测试。性能通过还必须同时通过现有 Node/Rust/TypeScript、OpenSpec 和真实 GUI smoke，不能用更快但失去交互正确性的实现过关。

## Risks / Trade-offs

- [动态窗口首次创建可能让首次 About、Preferences 或 viewer 比当前预声明窗口慢] → 启动只延后低频窗口；ready 后保留实例，viewer 以详情图片 cache 预热并并行 payload/image/show，分别记录首次和重复打开预算。
- [preview 预热与用户立即打开 main 竞争 CPU] → 预热安排在 tray-ready 后并设置幂等 ensure；用户动作优先，预热不得阻塞 main show。
- [ready event 丢失、旧 generation 回报或并发创建导致窗口永远等待] → registry 以 generation + single-flight 管理，ready 注册先于 payload，所有等待有界超时和销毁/重试路径。
- [内存仓储使桌面进程与外部 CLI 同时写同一历史文件时出现陈旧快照] → 写入前检查文件 metadata/revision fingerprint；发现外部变化时重新加载并生成 replace revision，保留原子写入。跨进程强一致锁留待单独 change。
- [delta reducer 漏掉去重移动、裁剪或复制次数更新] → 用现有 merge 语义生成 mutation result，针对 upsert/move/remove/trim/clear/out-of-order revision 建立对照测试。
- [base64 cache 增加常驻内存] → 以编码后字节数计费、32 MiB LRU、单项上限、cleanup invalidation 和可观测 hit/miss 指标约束。
- [路由拆包产生过多小请求，反而拖慢辅助窗口] → 由 Vite manifest 和真实 trace决定共享 chunk 边界；只按窗口职责拆分，不按单组件碎片化。
- [把 native window 属性移到创建期可能破坏 macOS/Windows 重复打开] → 明确区分不变量和每次转场状态，保留现有错误恢复，并分别 smoke 首次/重复、最大化/恢复、换显示器和 Escape。
- [性能日志泄露用户数据] → schema 只允许枚举、数字和匿名 interaction id，测试断言拒绝路径/文本字段，默认发布运行关闭详细 trace。

## Migration Plan

1. 先加入性能里程碑、临时 fixture 和当前版本 baseline，不改变窗口或数据路径。
2. 建立窗口路由模块和 Vite manifest 预算，确认功能不变后再引入动态窗口工厂与 ready registry。
3. 先让 preview 家族通过 ensure/ready 路径工作并完成真实 hover smoke，再把 About、Preferences、viewer 移到按需创建。
4. 引入 `DesktopStateRepository` 和完整 snapshot API，保持旧 full event 兼容；验证后切换到 revision delta，再删除旧广播。
5. 加入有界图片 cache 与前端 promise 合并，验证删除、cleanup、失败和同图跨窗口路径。
6. 精简有测量证据的 window/React/CSS 热点，运行优化后 benchmark并与 baseline 报告对比。
7. 运行 `npm run check`、全部 Node tests、Windows target check、bundle budget、严格 OpenSpec 校验、`git diff --check`，再完成 macOS release-build 全链路 smoke；Windows CI/真机补齐对应证据。

每一阶段保持可单独回滚。若动态窗口在任一平台不能稳定满足 ready/hover 预算，可恢复 preview 静态预声明，同时保留路由拆包、仓储和图片 cache；历史与设置文件格式未迁移，因此回滚不需要转换用户数据。

## Open Questions

- Windows WebView2 冷启动的绝对预算需要在 apply 后由 `windows-2022` artifact 或真机基线校准；在此之前以同设备相对改进和功能无回退为硬门槛。
- 32 MiB 图片 cache 在历史上限扩展到 500 后仍保持固定总量和单项边界；正式性能 fixture 继续使用 200 条以保持前后数据可比，不得因历史条数增加而无界增长。
