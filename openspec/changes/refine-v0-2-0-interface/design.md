## Context

动机见 proposal。当前界面是 Operate 模式：从托盘快速查找、预览、复制，然后回到原应用。采用保留式改进，`DESIGN_VARIANCE=2`、`MOTION_INTENSITY=1`、`VISUAL_DENSITY=9`，优先可扫描性和原生习惯。

当前主窗口 320px，Preferences 820×600，quick-action 560×420；preview 与 preview-detail 独立且不可聚焦。设置有串行即时保存及回滚。主题来自 `styles.css`，色彩已经分为青绿交互、暖色元信息、红色危险操作；系统字体为 SF Pro Text / Segoe UI Variable / system-ui。相关源码事实和审查边界见 ui-review。

## Goals / Non-Goals

**Goals:**
- 设置按用户控制的对象归类，搜索和可访问标签同时迁移。
- 转换保持一次点击可达，阅读内容优先；不为菜单交互改变 preview 焦点模型。
- 深色、浅色各自保持可读层级，系统主题变化在已打开窗口生效。
- 托盘新入口与主窗口入口使用相同窗口生命周期。

**Non-Goals:**
- 不替换设计语言，不引入装饰玻璃、营销字体、大卡片或动画库，不机械套用手机 44px 控件尺寸到 320px 桌面列表。
- 不修改转换算法、增加流水线编辑器、改造编辑器/虚拟化系统或改变隐私规则。
- 不改变 CLI 安装协议、应用版本、公开发布状态或 Linux 支持级别。

## Decisions

### 1. 原生菜单复用 Preferences 入口

菜单结构固定为：

```text
偏好设置…
──────────
退出 mclip
```

保留 `show_menu_on_left_click(false)` 与原有左键切换。Rust 原生 menu event 异步调用既有 `show_preferences_window`，复用 ready registry、居中、show/focus。调用前清理 preview 家族及主窗口预览状态，防止打开设置后旧请求重新弹出；优先复用已有关闭流程，必要时抽取共用协调函数。连续打开只聚焦一个设置窗口，首次失败后可重试，不阻塞 tray event 线程。

现有跨边界契约保持：

```rust
#[tauri::command]
pub async fn show_preferences_window(app_handle: AppHandle) -> Result<(), String>
```

```ts
export function showPreferencesWindow() {
  return invoke<void>("show_preferences_window");
}
```

无需新 IPC、capability 或 tray 插件。沿用项目已经使用的 `tauri::menu`/`tauri::tray`，以锁定依赖 API 为准，不套用 skill 中未经当前依赖验证的安装示例。

菜单两项使用与 AppLanguage 相同的 resolve 规则，中英日资源齐全。保存语言成功后更新已有菜单项，不重建 status item，保留 macOS autosaveName。系统 locale 在现有语言解析时机刷新，不新增 OS locale watcher。菜单错误使用稳定 reason code；优先向可用的主窗口反馈简短可重试错误，启动/更新失败保留可用菜单而非让整个托盘退出。

菜单快捷键本轮不新增全局注册；保留 main 中 `⌘,` / `Ctrl+,`，不显示尚未接通的菜单 accelerator。

### 2. 放大有效轮廓，保留记事本 m

canonical SVG 24×24，当前带描边轮廓约宽 16.5、高 20，约占画布 69%/83%。首选整体等比放大约 8%-10% 并光学居中，目标接近宽 18、高 22，仍留安全透明边距。轮廓、装订线、小写 m 一起放大，不只加粗外框。

保留 source marker、显式单色路径、512px runtime/128px Preferences 派生文件和 `menuBarIconStyle: "m"`。16/18/22px 比较必须包含真实 1×大小与放大检查；PNG 分辨率不是 OS status item 的点数。macOS 保留 Template Image，不随应用浅深色自行换色。Windows/Linux 不假设 `icon_as_template` 能自动着色；若原生深色托盘中不可辨识，单独记录并在本轮原生验证中选最小的系统外观适配，不因扩大面积声称已解决系统着色。

替代方案：放大系统 status item 会增加占位且跨端不可控；只提高 PNG 分辨率不解决留白；换 logo 违反保留既有设计的意图。

### 3. 设置归属与名称

```text
搜索设置
通用
  行为     登录启动、自动粘贴、权限及 Linux 能力
  外观           界面语言、主题、托盘图标、列表显示
  历史           保存类型、普通历史保留上限、主窗口/分组展示条数
  隐私           遮罩、旧历史分类、忽略应用
工具
  文本操作       JSON / Base64 / URL 组件开关
  Agent CLI      安装状态、版本、安装动作和使用入口
```

`general`/`appearance` 等内部 ID 不变；侧栏内部 group key 可继续用 `mclip`，用户文案改为“通用 / General / 一般”。原 General 页显示“行为 / Behavior / 動作”，避免同名层级。

外观页三个组：
1. 界面：语言、主题。
2. 托盘图标：三种图标选项与当前选中状态；平台用语可显示“菜单栏图标”或“托盘图标”。
3. 列表显示：Logo、序号。

历史页增加“列表显示”组，包含主窗口普通历史条数、分组普通历史条数；保留置顶另计的简短说明。

不把“最大历史条数”移入外观，它会裁剪已保存数据。移动控件时保留 setting ID 和焦点 anchor，只更新 destination/path/metadata，避免失效定位；更新语言和 display count 搜索别名。用户输入任一支持语言下的“语言/主题/列表/保留”都能找到对应设置，索引不包含历史或私有路径。

沿用 820×600 和 220px 侧栏，内容单一纵向滚动；外观行数增加后允许滚动，不压成多列小字，也不自动增大原生窗口。页标题不重复大段解释，普通帮助文字转为中性色；隐私和危险说明保留可见。

替代方案：只改 MCLIP 会产生“通用 > 通用”；只移动语言而保留两个“界面”标题不能完整解决归类。全改一级导航或去掉分组会增加学习成本，不在本轮采用。

### 4. 转换按内容类型分行

详情保持“标题及置顶/删除 -> 内容 -> 转换 -> 复制元信息”的既有整体方向，通过压低元信息强调色、稳定工具行改善阅读。推荐布局：

```text
文本转换
JSON       [格式化] [压缩]
Base64     [编码]   [解码]
URL 组件   [编码]   [解码]
```

示意图展示支持的全体操作，不代表同一输入同时适用所有操作。仅渲染已开启且后端判定适用的动作；无动作的类型行不占位。文本按钮无需重复“Base64 编码”等长名称，但可访问名完整包含类型，URL 组件不简写成会改变含义的完整 URL 编码。

每行类型标签占一列、动作占后两列；类型列可随三语长度变化，按钮至少 24px 高（12px 根字号下避免误把 Tailwind rem 当 16px），相邻动作保留 6-8px 间距。长标签先调布局/文案，不能缩到 9px 或省略动作含义。用 button/group 语义，不冒充有选中状态的 segmented control。

选择“详情单入口 -> 窗口内再选类型”的替代方案需要多一次操作，且会扩大结果窗口职责；popover/submenu 又会遇到非聚焦 preview 和跨窗 hover 生命周期。本轮采用直接可见分行，保留一次点击。

适用性请求状态用明确 union 表达 loading/ready/error，复用 request revision。短请求不闪 loading 字样；超过约 150ms 显示“正在检查可用操作…”，并保留稳定位置。失败显示“无法加载操作”与重试，空结果不留下孤立的“转换”标题。类型全关时整个工具区隐藏（含遮罩提示），遮罩且仍有开启类型时仅显示先查看内容提示；不把被遮罩原文送去做适用性查询。

操作运行时只显示该按钮的进行状态，并阻止同一请求重复打开。切换条目或主题、关闭/重新遮罩后旧响应不得重开窗口或覆盖新状态。

### 5. 结果窗口与高风险状态

```text
JSON 格式化                                  [关闭]
┌─────────────────────────────────────────────────┐
│                 转换结果，可滚动                 │
└─────────────────────────────────────────────────┘
错误/完成反馈                    [替换历史…] [复制结果]
```

保留独立 560×420 focusable quick-action。只有“复制结果”使用青绿色主按钮，替换使用描边/中性按钮，点击后再在确认区显示危险色。当前确认按钮已有 `isReplacing` 禁用，保留它并补复制/替换 handler 的互斥 guard 及 payload revision，避免双击与旧请求清掉新结果。失败保留结果可复制、可重试；成功沿用关闭窗口的反馈节奏，不增加阻塞停留。默认焦点避免直接落在替换确认上。

浏览器已复现：420px外壳的display为block，内部main仅255px，着色区域约282px，下部透明。将quick-action外壳设为满高flex列（或复用等价dialogPanel），确保背景覆盖完整内容区。长结果滚动容器 `min-height:0`，窗口标题/关闭/底部操作不被挤出。优先复用当前结果 `<pre>`，不为了美化装入代码编辑器。旧 history ID、置顶 metadata、复制原文语义、1 MiB 输入/4 MiB 输出限制均保持。

### 6. 深色、浅色分别设计与验证

以下为沿用的基础 token，按职责使用而非按组件随意选色：

| 职责 | 浅色参考 | 深色参考 | 用法 |
| --- | --- | --- | --- |
| 主文字 | `#0f1f1a` | `#f8fafc` | 内容、设置名称 |
| 次文字 | `#445951` | `#9aa7b6` | 帮助、路径、时间标签；普通说明不全部染暖色 |
| 表面 | `#f8fbfa` | 近似 `#121518` | 深色实际是 rgba，需要合成背景后测量 |
| 交互 | `#0b6f67` | `#73d0c8` | 选中、开关、焦点、复制主按钮 |
| 元信息 | `#7a4b06` | `#efc06f` | 序号、少量元信息；避免每段标题都强调 |
| 危险 | `#b42318` | `#ff756d` | 删除/替换确认与失败，须带文案或语义 |

按钮前景分别使用 on-control-active/on-danger-action，不把同一颜色文字直接用于实心背景。CLI badge基础class移除默认danger色，按状态输出唯一颜色class，避免当前current/newer同时携带冲突text class。正常安装用青绿、未安装中性、需处理状态用说明/暖色、失败用danger，状态不能仅靠颜色区分。敏感badge改用已定义的ink-dim或专用成对token，修复当前8px及未定义ink-faint；目标至少10-11px，实测主/分组行是否挤压内容。

字体继续系统 UI 字体，正文/操作 12-13px，次说明 11px，页标题约 16px；不更换整个字体包。圆角沿用窗口 20、容器 14、控件 8 和专用于 switch 的 capsule；避免多层嵌套卡片。保留已优化的 38×22 switch 和18px thumb。

对每套主题验证 default/hover/selected/focus-visible/pressed/disabled/loading/error，正常及次要可读文本目标均为 4.5:1，必要非文本状态/焦点为 3:1。disabled 有语义禁用且与 active 可辨；结构分隔线不一律强制 3:1，关键交互边界则需要。半透明面板在明亮、暗色和繁杂背景上采样合成值。

“跟随系统”不是第三套静态颜色：验证系统 light↔dark 时七个已打开窗口同步；显式 light/dark 不受 OS 主题切换影响。原生菜单、应用图标不强制跟随应用主题，macOS 模板图标按 OS 菜单栏着色。每个平台分别检查 UI 主题与 OS 主题相反的组合。

ui-ux-pro-max 数据库返回的营销 Hero/Glassmorphism/蓝橙配色不适合本产品，因此仅采纳其对比度、可访问状态和本地化检查；design-taste 的营销页规则同样不用于桌面窗口。

### 7. 复用、数据与规格协调

复用当前 PreferenceControls、DialogStatusBar、HistoryPinButton、HistoryDetailPanel、typed IPC 与测试 fixture。Tauri 原生 menu 已是维护中的通用实现，分行布局是少量 CSS，不需另造交互框架。若新增复杂弹层才重新调研成熟库；本轮不引入这种需求。

无数据迁移。变更 settings 的展示位置不修改字段；不读取用户真实历史做截图，使用合成 JSON、长文、文件名、模拟敏感内容和 CLI 状态。错误/截图/日志不含真实密钥或私人应用标识。

已有活动 change 尚未同步成完整基线，不能把本次严格校验解释为没有语义冲突。后续同步须先协调：

| 旧 delta | 本轮取代的具体条款 | 同步方式 |
| --- | --- | --- |
| optimize-preferences-settings-center / preferences-settings-center | Grouped Settings Center Navigation 的 mclip 分组、General 标签 | 保留导航/即时保存契约，用本轮标签替换旧场景 |
| 同 change / appearance-settings | Appearance Preferences Organization 中 language 留 General、Interface/Main Window 分组 | 以本轮外观归属为准重写旧场景，不能并存相反 SHALL |
| 同 change / history-display | History Preferences Organization 的展示数量仍在 History | 按用户最新反馈保留 History 入口，保存/裁剪与置顶另计不变 |
| refine-menu-bar-notebook-m-icon / appearance-settings | Notebook m Menu Bar Artwork | 保留识别、模板与文件契约，追加本轮有效尺寸验收 |
| add-text-quick-actions-and-pipelines / text-quick-actions | 适用性、结果复制/替换 | 保留原规则，本轮仅补展示/反馈要求 |

本次只写当前 change，不修改旧 change 的任务完成状态；正式 specs sync 必须显式执行上述合并检查，不能靠最后写入覆盖冲突，也不自动归档任何 change。

## Risks / Trade-offs

- 外观页控件增多 → 保留单一滚动区、搜索直达和合理分组；两主题三语言截图检查底部可达。
- 非聚焦 preview 不能自然接收 Tab → 不改成可聚焦；保留 main 的键盘入口，原生回归验证转换/详情可达；不得用浏览器 Tab 成功宣称 native preview 键盘支持。
- 图标放大后小尺寸糊合或顶边 → 先生成 16/18/22px 对照，检查 m 负空间和透明边缘；原生视觉可要求退回更小幅度。
- Windows/Linux 黑色单色图标在暗托盘不可见 → 不把 macOS Template Image 外推；记录命名环境及实际截图，未解决前不得勾选该平台验收。
- 原生菜单调用未同步清理前端 preview request → 复用完整关闭协议，测试慢请求后打开 Preferences 的竞态。
- 新条款与未归档旧 delta 冲突 → 同步时按上表合并，保留其它行为与证据，不批量同步/归档。

## Migration Plan

1. 先完成代码与合成数据渲染证据，再执行自动化及三平台原生验证；任务分开记录。
2. 自动化包括 `pnpm run check`、`node --test tests/*.test.mjs`、严格 OpenSpec 和 diff whitespace。若改 Windows 条件代码，追加 `cargo xwin` all-target 检查；若公开文案改变，补 site:test/site:build。
3. macOS 验证菜单首次/重复打开、深浅菜单栏、1×/2×；Windows 验证100/125/150/200%缩放、OS明暗托盘；Linux 分 X11 与命名 Wayland 会话记录 tray/shortcut/焦点能力，unsupported 保持可见说明。
4. 保留源码0.1.1；把本轮结果作为后续0.2.0发布输入。回滚只回退对应代码和派生资源，不改用户历史/设置，不推送 tag 或发布。

## Implementation refinement

Browser inspection at the original 304px detail width found the old text-only height estimate left grouped actions below the initial viewport. Initial placement retains a bounded estimate; after rendering, a ResizeObserver measures intrinsic content, header and footer in both compact detail windows. The native resize command accepts only the calling preview/preview-detail window, requires visibility, preserves X and clamps Y/height to the work area. Content is capped at 360 logical pixels before scrolling; actual conversion rows and discovery/reveal changes update the height. Retained windows remeasure after native placement/show; the image viewer is excluded. Switch hover no longer changes the track color in either theme.

The contrast pass retained semantic hues and adjusted dark secondary ink (`#b5c0cd`), dark danger (`#ff938c`), dark strong control borders (`#8b99a8`) and light secondary teal (`#09675f`). See the reproducible alpha-composition results in evidence/contrast.json; native wallpaper sampling is separate.
