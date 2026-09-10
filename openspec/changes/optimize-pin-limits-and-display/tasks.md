## 1. 配置与旧数据兼容

- [x] 1.1 扩展 Rust AppSettings、TS interface/defaults/normalize，加入默认 10、范围 5..=20 的 maxPinnedItems；用 Rust/Node 测试验证缺失值、两端边界、越界及非法编辑输入。
- [x] 1.2 抽取无 AppHandle 和系统副作用的 path-based 设置读取，供 CLI 读取历史相邻设置；fixture 测试证明缺失默认、损坏/不可读安全报错且不访问真实配置。
- [x] 1.3 分离新增 cap 和旧 100 pins/600 entries 兼容常量、断言；以含图片的 100 pins fixture 验证只读加载无写入，普通增删裁剪、去重后已有 pins/资源保留。

## 2. Rust 置顶约束与 IPC

- [x] 2.1 引入 PinLimitReached { current, max } 领域错误并接通 set/toggle、repository 和 path helper；单元测试验证连续 10 次成功、第 11 次失败、Unpin 后可新增，以及 cap=5 精准拦截。
- [x] 2.2 保证显式 set 幂等及桌面锁内计数/变更；测试重复 pin/unpin 不改时间/revision、9/10 时并发两个 pin 只成功一个、上限失败不写文件或更改资源。
- [x] 2.3 将 pin/set command 的现有错误契约扩展 current/max，TS 用 unknown 收窄并保留 code/message；序列化与错误映射测试覆盖限制错误、普通存储错误和无效 payload，不解析字符串获取计数。
- [x] 2.4 将已提交设置快照接入置顶入口；repository 测试覆盖降低至 5、提高上限及超限状态仍可 Unpin；核对设置先持久化再提交，浏览器验证保存失败回滚，CLI fixture 覆盖旧超限记录。

## 3. Preferences 与统一反馈

- [x] 3.1 历史页增加复用 PreferenceRow 的紧凑数字控件与超限保留说明，接入串行保存/回滚；组件或浏览器测试验证上下界、有效输入即保存、空值/小数不提交、失败回滚。
- [x] 3.2 补齐中文、英文、日文设置标签、搜索词、可访问标签和 Toast 文案（含 max=20 分支）；运行词典契约测试并验证搜索能定位控件。
- [x] 3.3 调研 Sonner 等维护活跃的 Toast 方案并记录选型证据，接入共享 Toast host/service；验证 React 19 兼容、6 秒提示、单条替换、live region、无自动焦点和无默认热键干扰。
- [x] 3.4 统一 preview、preview-detail、image-viewer 的 pin hook/pending/catch；mock IPC 验证错误送至 main 或可见 viewer、一次失败只显示一次、普通错误安全回退、无未处理拒绝。
- [x] 3.5 补充 typed 定向错误事件和卸载/失效清理；生命周期测试证明关闭窗口后的迟到错误不 show/focus 或重开 preview，保持既有 ready 协议、能力范围及历史 delta 行为。

## 4. 主列表标识、编号与键盘

- [x] 4.1 普通编号按过滤后普通历史独立派生，保持 canonical ID/order、分组范围及分组局部编号；纯函数测试覆盖混合、全 pins、全普通、搜索筛选和 pin/unpin 后重新编号。
- [x] 4.2 主列表序号槽复用 PinIcon，关闭数字仍显示被动 pin 状态并保留分隔线；组件/浏览器检查三类行、深浅色、可访问名称、无行内新按钮和未增加行高。
- [x] 4.3 新增共用数字选择纯函数并接入 App 键盘选择路径；测试 1..9、0、缺项、隐藏数字、输入框/textarea/contenteditable、IME、repeat、所有修饰键、确认框和分组键盘模式。
- [x] 4.4 验证选中调用原有复制/自动粘贴路径，方向键/Enter 可遍历 pins→普通→分组→footer；运行根目录交互契约测试并记录浏览器键盘/scroll smoke。

## 5. CLI 对齐与 JSON 元数据

- [x] 5.1 pin/unpin 改用显式最终状态和对应设置，保持 --id/--index 语义；真实二进制 fixture 测试验证 cap=5/10/20、幂等、超限允许 unpin、stderr/exit 1/stdout 空和失败文件不变。
- [x] 5.2 实现 list JSON 的 --with-meta 选项与 camelCase meta/data DTO；集成测试覆盖完整历史 pinnedCount、kind/pinned/limit 过滤、空列表、旧超限历史和两种 JSON 参数写法。
- [x] 5.3 保留旧 list 数组及其它命令/Agent schema，更新 CLI help/能力说明；测试非法 --with-meta 组合 exit 2、help/version/transform 不读文件、旧 list 不依赖 settings。
- [x] 5.4 验证 metadata 模式复用现有敏感遮罩和显式 reveal，data 保留 text/image/files 联合字段；通过 CLI 合成 fixture 检查默认遮罩、揭示选项、原始数据不被写回。

## 6. 文档与自动化验收

- [x] 6.1 实施完成后对齐 AGENTS.md、PRODUCT.md、README.md、项目内 memory.md、openspec/project.md/config.yaml/README.md 与公开中英日产品/CLI 文案和 llms.txt；检查不再把 100 描述成当前新增上限，明确 --with-meta 和 GUI/CLI 序号差异，并保留发布状态。
- [x] 6.2 按 design 协调表准备后续显式 sync 的 pinned-history/history-display 完整冲突消解记录；交付 reconciliation 文档，确认旧原生任务未自动勾选、没有提前同步/归档。
- [x] 6.3 执行 pnpm run check、node --test tests/*.test.mjs、pnpm run cli:test，将结果与 fixture 范围记录到 verification.md；失败修复后重跑受影响门禁。
- [x] 6.4 执行 pnpm run site:test、pnpm run site:build、openspec validate --all --strict --no-interactive 和 git diff --check；记录实际结果并核对仅有本次预期变更。

## 7. 原生与跨平台证据

- [ ] 7.1 macOS 原生验证主列表/分组详情/viewer 超限反馈、焦点不丢失、置顶与普通编号、搜索数字不误复制、三语深浅色及 20 pins 小屏滚动；逐场景记录原生结果，mock/build 不代替该项。
- [x] 7.2 执行 XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets 并记录 Windows 源码检查结果；明确它不代表 Windows 原生验收。
- [ ] 7.3 在 Windows 原生设备验证相同 pin/Toast/键盘流程并记录三语与深浅色结果；没有设备时保留未完成。
- [ ] 7.4 在可用 Linux 预览会话验证设置、pin/CLI 与 Toast 基本流程并注明 X11/Wayland 会话、支持降级及设备信息；没有设备时保留未完成，不由 macOS 或 Windows 结果推断。
- [x] 7.5 汇总自动化、mock 浏览器、原生与缺失证据，给出可复现步骤和旧数据回滚边界；确认未修改版本、发布 tag、Draft 或远端资产，发布仍由独立 release change 管理。
