## Context

动机见 [proposal.md](proposal.md)。2026-09-08 核对源码：置顶逻辑在 `history.rs` 和 `DesktopStateRepository`，当前是字符串前缀错误映射到 `HistoryCommandError { code, message }`；CLI 未读取设置，且 pin/unpin 经一次选择后再 toggle。主列表 `position` 在搜索前按完整历史计算；当前键盘支持方向键、Enter 和 footer 快捷键，没有数字快速选择。部分辅助窗口的 pin Promise 没有 catch，另一处只记录控制台错误。

`AppSettings` 使用扁平 camelCase 配置，Preferences 有串行保存/回滚控制器和历史页。无 Toast 库，已有共享 `PinIcon`。运行时为七个窗口，preview 家族不能聚焦，主窗口固定 320px。

## Goals / Non-Goals

**Goals:** 在现有持久化和定向 delta 链路中落实一个配置真相；使错误保留结构化计数；将 GUI 显示序号、GUI 数字选择、CLI 全列表选择器明确分开；让旧数据升级可逆且不丢失置顶。

**Non-Goals:** 不重构整个项目错误系统或拆分 crate，不实现跨进程事务锁，不修改普通历史裁剪、敏感分类、复制/自动粘贴语义或辅助窗口架构。功能实施、原生验收和发布分开。

## Decisions

### 1. 扁平配置和非破坏的上限迁移

新增 `AppSettings.max_pinned_items: usize`，serde 默认 10；JSON/TS 为 `maxPinnedItems: number`。Rust sanitize 和 TS normalize 都把有效整数 clamp 到 5..=20。TS 对缺失、非数字、非有限数、小数回退 10；Rust 的 usize 反序列化拒绝非整数/负数等非法类型，沿用桌面整体配置解析失败回退默认的既有策略。UI 不提交空值或小数；有效整数经规范化后进入现有串行保存队列。配置保存成功广播现有 settings 更新，失败回滚，不增加确认按钮。

历史页在保留数量附近增加紧凑 number 输入，min=5、max=20、step=1，复用 PreferenceRow 与反馈。中英日补标签、描述、可访问名称和搜索关键词。当前已置顶数超过新上限时显示短说明：已有置顶保留，取消至低于上限后可新增。达到 20 的错误提示只建议取消置顶，避免建议不存在的扩容空间。

拒绝新建 PinSettings 配置层：一个标量无需额外迁移层。也拒绝下调设置时自动 unpin/删除。旧版最多 100 条置顶全部保留；`MAX_PINNED_HISTORY_COUNT` 和 600 条持久化断言不能简单改为 20/520，实施时将其明确命名为兼容旧数据的边界，与新增置顶配置分开。普通裁剪、去重、替换文本、资源清理都不得按新 cap 裁剪既有 pins。

### 2. 共享类型化错误与持久化入口

history 领域提供 `PinMutationError::PinLimitReached { current: usize, max: usize }` 和包装既有存储错误的分支；名称无需全局 MclipError 重构。set/toggle、path helper 和 repository 传入同一份规范化上限，计数在实际历史 mutation 内完成，早于修改 metadata/持久化/revision。显式 set 必须先判定已达目标状态，重复 pin 不刷新 pinnedAt，取消置顶不受 cap 限制。桌面 toggle 在 repository 历史锁内读当前 pin 状态，连续并发请求不能越过同一配置快照的上限。

扩展现有 IPC error，并保留 code/message 以兼容旧消费者。上限错误必须有 current/max，普通错误省略这两个字段；前端以 unknown 收窄，不解析错误消息取得计数。

```rust
#[tauri::command]
pub async fn toggle_history_item_pinned(
    app_handle: AppHandle,
    id: String,
) -> Result<Option<HistoryChange>, HistoryCommandError>

// Serialized limit error:
// {"code":"pinnedHistoryLimitReached","message":"...","current":10,"max":10}
```

```ts
interface PinLimitError {
  code: "pinnedHistoryLimitReached";
  message: string;
  current: number;
  max: number;
}
interface HistoryMutationError {
  code: "historyMutationFailed";
  message: string;
}
type HistoryCommandError = PinLimitError | HistoryMutationError;

export function toggleHistoryItemPinned(id: string) {
  return invoke<HistoryChange | null>("toggle_history_item_pinned", { id });
}
```

现有 `set_history_item_pinned` command 同样升级错误映射，参数和成功响应不变。不新增 command 或文件读取 capability；设置读写仍用现有 get/save 契约。失败只返回错误，不伪造成功 delta；存储/权限错误显示稳定通用提示，不把路径、条目 ID 或原始错误带进 Toast/日志。

### 3. 多窗口 Toast 采用共享服务和明确的可见目标

提案选择应用内 Toast，不用系统通知，不新增窗口。实施前评估 Sonner 当前 React 19 支持、维护状态、依赖体积和可禁用热键/自动焦点能力，记录选型证据，优先采用维护活跃的库。

所有 pin 入口改用共享 hook/service 捕获错误及 pending 状态，避免连续双击或 unhandled rejection。main 挂载共享样式的 Toast host；preview 和 preview-detail 的错误通过 typed 定向事件送至可见 main。image-viewer 自己挂载同一 host，因为 main 可能被 viewer 覆盖。主窗口收到事件仅显示提示，不能 show/focus、打开旧 preview 或广播历史。事件只含稳定 code 和数字计数；按操作去重，不能让同一次失败同时出现在两个 host。

默认中文：“置顶已达上限 ({current}/{max})。请先取消部分置顶，或在设置中提高上限。”英文、日文提供等价资源。max=20 使用取消置顶版本。Toast 最多显示一条，长文换行，至少停留 6 秒，用可访问 live region，无自动焦点和操作按钮；重复错误更新当前提示。语言/主题随现有设置解析；页面销毁清理 listener，隐藏窗口/失效请求不会重开窗口。原生不可聚焦 preview 的鼠标命中逻辑完全保留。

### 4. 序号只表达普通历史位置

复用 `UiIcons.PinIcon`，浅色与深色主题都采用可辨认的语义次级颜色；不另加 Lucide 包，不用 ↑，避免与键盘向上导航含义混淆。标识无点击行为，行仍只有一个选择目标，操作按钮仍在详情标题栏。保留细分隔线，不加“置顶/最近”标题。关闭显示序号时只隐藏普通数字，Pin 标识仍显示（传达状态）；无普通行时不绘制分隔线。

将过滤后的普通序号作为派生展示值，不能改 stable ID、render identity、canonical 排序或 IPC 中的历史实体。主列表普通匹配从 1 编起，搜索变化重算；置顶不占编号。分组仅含普通历史、范围仍按普通计数，分组行继续局部从 1 开始。

共享纯函数从当前 visible 普通历史解析数字目标。无修饰 1..9 选第 1..9 项，0 选第 10 项；超过 10 项用方向键/Enter，不加字母序号、多键序列或全局注册。输入框、textarea、contenteditable、组合输入、repeat、任何修饰键、确认框、分组键盘模式时不触发；无对应项时不拦截事件。选中复用现有 select/复制/自动粘贴路径。数字隐藏时行为不变；方向键继续遍历 pins、普通项、分组、footer。

### 5. CLI 配置读取与兼容 JSON

真实命令保留 `mclip-cli pin --id ID` / `--index N` 与 unpin。CLI 显式 set 目标状态，取消先比较旧快照再 toggle 的做法；path helper 每次加载最新历史后做幂等性和限制校验。CLI 索引仍指完整 canonical 列表（含 pins），与 list 输出一致，GUI 普通序号不得混入 CLI 选择逻辑。

从选定 history 路径同目录的 `settings.json` 读取规范化 `AppSettings`，默认 history 路径因此自然对应桌面配置目录。`--history-path` fixture 使用自己的相邻设置，缺失则默认 10，不偷读真实用户配置。抽取无 AppHandle、无登录启动副作用的读取 helper。pin/unpin 及带 meta 的 list 读取配置；help/version/transform 和旧版 list 输出不增加设置 I/O。缺失文件使用默认；已存在但不可读/格式损坏时 CLI 以不含私有路径的配置错误退出 1，不悄悄用默认放宽限制，不写回配置。数值越界整数由 sanitize clamp。

达到上限时退出 1，stdout 为空，stderr 沿用 CLI 前缀：`mclip-cli: Pin limit reached (10/10). Unpin an item first or update settings.` max=20 提示仅取消置顶。此处适配现有 CLI 错误格式，不新增 `mclip pin <id>` 别名。

显式 `list --json --with-meta` 或 `list --format json --with-meta` 返回：

```json
{
  "meta": { "pinnedCount": 3, "maxPinnedItems": 10 },
  "data": []
}
```

`pinnedCount` 统计选定文件的完整历史，在 kind/pinned/limit 筛选前计算，便于准确判断能否新增；data 使用原有过滤、顺序、默认 limit 和敏感遮罩。历史条目继续使用 `kind`、`text/imagePath/filePaths`、`isPinned` 等现有字段，不引入泛化 content 或 snake_case DTO。`--with-meta` 不配 JSON 或用于其它命令时为 usage error（exit 2）。旧 `list --json` 数组不变；其它 read/agent 的输出和 schema=2 不变。拒绝直接更换默认 JSON，以保留既有 Agent/脚本调用。

### 6. 与未同步规格协调

本 change 的三个 delta 路径与 proposal 一致。history-display 采用 ADDED 新要求，因为已同步主规格还没有旧 pin 交互 requirement；不得伪造不存在的 MODIFIED 基线。

| 旧 change / 规则 | 本 change 生效后的协调 |
| --- | --- |
| add-pinned-history-items / 固定 100 新增上限 | pin-limit-settings 的配置 cap 优先；100 只作旧数据兼容边界 |
| add-pinned-history-items / 不显示每行 pin marker | 新增的被动序号槽 Pin marker 优先；仍无行内 pin 按钮 |
| add-pinned-history-items / 普通分组和可见顺序遍历 | 保留 |
| refine-v0-2-0-interface / 设置归类、主题 | 复用最新历史页、外观页、theme token |
| add-sensitive-content-protection / CLI 遮罩和 Agent schema | 保留；meta 不绕过 presentation_entries |

后续显式 sync/归档时，先处理旧 pin 基线，再按本 change 调整上述冲突场景；将对 `pinned-history` 和 `history-display` 的最终 reconciliation 列为独立任务。当前只创建提案，不自动同步旧 delta、不勾选旧原生任务、不改发布门禁。

## Risks / Trade-offs

- [旧用户已有 21..100 个 pins] → 全部保留、允许暂时超限，UI 明示只限制新增；测试包括普通裁剪与置顶图片资源存活。
- [CLI 多进程或 CLI/桌面同时写文件] → 沿用现有原子文件替换和外部 reconciliation；本轮只保证单次操作对已读取历史校验与桌面进程内序列化，不宣称跨进程线性一致。共享文件锁需另立工作。
- [错误 Toast 被独立窗口遮挡或改变焦点] → main/独立 viewer 分配 host，原生验证 preview 家族与 viewer 路径，浏览器 mock 只证明布局和路由。
- [保存与 pin 请求同时发生] → pin 使用操作开始时最新已提交设置快照；保存完成后的新请求必须使用新值；保存失败不能改变有效 cap。
- [新增数字键误复制] → 文本编辑/组合输入等严格排除并测试；沿用已有选择行为，不对搜索框拦截数字。
- [库选型受不可聚焦窗口限制] → 先做适配验证，禁用默认焦点和热键；不得通过改变窗口 focusable 来迁就 Toast。

## Migration Plan

1. 新字段缺省读取为 10；只读加载不写 settings/history，既有 pins 无任何数量迁移。
2. 在一次功能实施中对齐 Rust、TS、CLI 与三语文案；加 fixture 覆盖旧文件和 100 条 pins。已有 cap 常量/断言区分兼容边界。
3. 实施后更新 AGENTS/PRODUCT/README、项目内 memory.md 和 OpenSpec 上下文、公开中英日页与 llms.txt；记录新行为适用版本，不将源代码状态写成已发布。
4. 回滚源码不会因新增配置字段丢失历史；旧版可能忽略新字段并恢复 100 的新增上限，旧版再次保存设置也可能去掉字段，重升后回到默认 10。无需手动删改用户数据。
5. 自动化执行 `pnpm run check`、`node --test tests/*.test.mjs`、CLI fixture 集成测试、相关官网检查及严格 OpenSpec 校验。单独记录 macOS/Windows 原生 smoke，Linux 仅限已有预览会话；无设备时保留未验收。此次提案阶段只校验文档，不运行应用测试或创建发布资产。
