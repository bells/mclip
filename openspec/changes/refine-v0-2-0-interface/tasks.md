## 1. 固定实施基线与审查证据

- [x] 1.1 对照 design 的规格协调表和 ui-review 建立本轮 verification.md，记录起始提交、现有未提交项、四项需求和逐页面范围；确认不修改旧 change 完成状态或真实剪贴板数据。
- [ ] 1.2 使用合成数据记录当前七窗口及设置六页的浅/深主题截图，包含长中文/英文/日文、空/加载/失败/禁用状态；截图标记浏览器 mock 或原生，不能混用证据。

## 2. 原生托盘偏好设置入口

- [x] 2.1 创建“偏好设置… / 分隔线 / 退出 mclip”菜单结构和中英日标签解析，保存语言后更新已有菜单；以菜单顺序、语言/system回退测试确认，左键行为和 macOS status item identity 保持。
- [ ] 2.2 从 tray event 复用既有 Preferences ready/show/focus 与 preview 清理协议，处理创建失败和重复请求；以延迟创建、重复打开、旧 preview request 的生命周期回归证明只显示一个设置窗口。

## 3. 记事本 m 光学尺寸

- [x] 3.1 在24×24画布内将记事本及m整体放大约8%-10%并居中，运行 `pnpm run icons:generate-menu-bar-m` 更新两个派生PNG；验证源标记、尺寸、alpha边距、非裁剪与旧设置兼容。
- [ ] 3.2 生成旧/新图标16、18、22px实际大小及放大对照，检查浅底、深底和模拟Template着色，保存比较图；确认笔画不糊合，注明该图不是三平台原生渲染证据。

## 4. 设置信息架构

- [x] 4.1 将侧栏MCLIP显示改为“通用”，general页面改为“行为”，同步中英日文案但保留内部destination；用导航渲染测试确认没有“通用 > 通用”重复。
- [x] 4.2 语言移到外观的界面组，保留主题/图标/Logo/序号；main/group展示数量归历史，和保存类型、保留上限同页；用setting ID唯一性、边界值和设置保存回归确认不改变数据规则。
- [ ] 4.3 更新搜索metadata/path/aliases和焦点定位，保留稳定setting ID；逐语言搜索语言/主题/展示数量/保留上限并验证目标页、scroll与focus，以及Escape分层行为。
- [x] 4.4 整理设置说明层级：普通帮助使用次文字，隐私/权限限制可见且简短，CLI状态与主要动作清楚，保留38×22开关；在820×600浅/深和三语长标签下确认单纵向滚动、控件不遮挡、保存失败仍行内回滚。

## 5. 文本转换与结果操作

- [x] 5.1 将转换动作映射为JSON/Base64/URL组件紧凑行，操作全名用于可访问标签；以普通文本、JSON、可解码Base64、百分号编码、图片/文件和类型开关fixture验证适用性过滤及无空行。
- [ ] 5.2 补全适用性loading/error/retry/empty状态，全部关闭时不显示遮罩提示，保留隐私与revision保护；以延迟/失败/重试/快速换条目/重新遮罩用例验证无原文泄露和旧请求回显。
- [ ] 5.3 修复quick-action外壳满高flex列和完整背景，将“复制结果”提升为主操作，“替换历史…”为次操作并保留危险确认，精简重复关闭动作；用两主题三语短/长结果截图和DOM几何确认无底部透明空洞、按钮始终可达。
- [ ] 5.4 保留既有isReplacing禁用，补复制/替换互斥guard与payload revision，错误保留结果可重试、成功仍关闭；以双击、延迟旧响应、新结果替换和失败fixture验证只有一次提交且旧操作不清空新payload。

## 6. 跨窗口主题与状态一致性

- [ ] 6.1 修复CLI badge冲突颜色class及敏感badge未定义token/8px小字，普通说明降低暖色强调，保留系统字体和紧凑密度；在浅深主题检查current/newer/notInstalled/outdated/unknown/failed实际计算颜色和主/分组敏感行，不做无关大改版。
- [x] 6.2 校验两主题实际合成背景的文字4.5:1、必要控制/焦点3:1，覆盖hover/selected/focus/pressed/disabled/loading/error；保存对比度数据及截图，失败项修复后只做一次有界确认。
- [x] 6.3 检查七个已打开窗口的system light↔dark同步和显式light/dark保持，修正受本轮影响的主题更新路径；用主题事件fixture验证并单列原生OS切换结果。
- [ ] 6.4 回归置顶/删除/清空确认、隐私显示/忽略应用状态、图片viewer恢复/Escape、About标题栏、CLI五种版本状态与Linux降级说明；仅修复本轮视觉/反馈缺陷并逐项记录，不新增业务功能。

## 7. 自动化与文档

- [x] 7.1 运行 `pnpm run check` 与 `node --test tests/*.test.mjs`，确认构建/Rust/前端契约全通过；若涉及Windows条件代码，运行 `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets` 并分别记录。
- [ ] 7.2 以合成IPC浏览器fixture验证两主题/三语言下的设置导航、转换loading/失败/结果及键盘；一次批量检查、一批修复、至多一次确认，保留平台/缩放/viewport记录，不将mock当原生。
- [x] 7.3 更新实际行为涉及的PRODUCT/AGENTS/README及OpenSpec索引说明，保持源码版本和发布边界；若触及官网/公开文案，运行 `pnpm run site:test` 和 `pnpm run site:build`，否则记为不适用。
- [x] 7.4 运行 `openspec validate refine-v0-2-0-interface --strict --no-interactive`、`openspec validate --all --strict --no-interactive` 和 `git diff --check`；对照design协调表核查新旧delta冲突，明确待后续sync合并，不自动归档。

## 8. 原生平台验收与交付边界

- [ ] 8.1 macOS原生验证菜单首次/重复/失败重试、左键、preferences聚焦、preview旧请求、1×/2×图标和系统明暗；七窗口两主题及应用/OS相反主题组合有逐场景记录，缺项保持未勾选。
- [ ] 8.2 Windows原生验证100/125/150/200%缩放的托盘与设置/转换布局、OS明暗和显式相反应用主题、菜单键盘与窗口焦点；黑色图标不可辨识需修复或记为未完成，cross-check不能代替。
- [ ] 8.3 Linux在命名的X11桌面会话验证托盘菜单、浅深图标、缩放、窗口位置与转换；记录桌面环境/面板及可用能力，缺设备不得勾选。
- [ ] 8.4 Linux在命名的Wayland compositor会话验证可用菜单/窗口路径和降级提示，确认来源排除仍unavailable；不能从X11或一个compositor外推其它会话支持。
- [x] 8.5 汇总已实现、自动化、mock渲染、原生待办及旧delta同步注意事项作为0.2.0发布输入；交付不改版本、不推送tag、不发布/替换资产、不归档旧change，原生缺项保持待办。


## 9. 2026-09-08 截图反馈

- [x] 9.1 两个独立详情按实际内容测量高度，长内容可滚动，保留工作区边界与非聚焦行为；完成构建、窗口回归及两种转换行数的合成浏览器几何核对，原生验收仍归8.x。
- [x] 9.2 去掉开关悬停底色；浅/深色均核对关闭后hover与移开颜色一致。
- [x] 9.3 页面改名“行为”，同步英文Behavior、日文動作及现行文档。
- [x] 9.4 两个展示条数归历史的列表显示组，同步搜索目标、原setting ID、规格与回归测试。
