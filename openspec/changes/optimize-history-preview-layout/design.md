## Context

`mclip` 已经把主界面单条详情、历史分组列表和 `preview-detail` 配置为独立的展示职责，但当前分组 hover 路径仍调用 `show_history_group_preview_with_detail_window`，把详情面板拼进 `preview` 窗口并把整体高度扩展为分组列表与详情偏移所需高度。与此同时，分组窗口高度由 `getGroupPreviewHeight()` 中的固定基数和行高估算；一旦实际 Tailwind 行尺寸与常量发生偏差，底部就会出现空白。

删除入口也存在两套模型：主界面单条详情通过 `HistoryDetailPanel.headerAction` 展示删除按钮，历史分组则在每个列表行右侧展示删除按钮，而独立 `preview-detail` 没有动作。此次变更涉及 React 跨窗口状态、Tauri event/invoke 契约以及 Rust 原生窗口定位，必须保持 preview 家族窗口不可聚焦、跨窗口鼠标命中与屏幕边界保护。

## Goals / Non-Goals

**Goals:**

- 分组列表窗口以实际内容高度为准，消除不必要的底部空白，并在高度受限时只滚动列表区域。
- 分组 hover 详情使用现有 `preview-detail` 原生窗口，按单条内容独立定高，不改变分组列表窗口高度。
- 主界面单条详情和分组 hover 详情复用相同详情结构与删除动作外观。
- 删除后由后端 `history-updated` 事件刷新主窗口和分组数据，避免跨窗口维护第二份持久化状态。
- 保持现有键盘导航、指针轮询、详情左右翻转以及选择后彻底关闭 preview 的行为。

**Non-Goals:**

- 不修改历史数据结构、分组范围算法、保存条数设置或复制/自动粘贴语义。
- 不把分组列表和详情重新合并为一个 React 页面或一个可聚焦大窗口。
- 不重新设计详情内容、元信息字段、主题系统或其他弹窗。
- 不新增通用 UI 或窗口管理依赖。

## Decisions

### 1. 分组列表与 hover 详情使用两个原生窗口

`preview` 在分组模式下只渲染分组标题和列表；hover 或键盘激活某条记录时，通过 `updateHistoryPreviewDetailWindow` 使用独立的 `history-preview-detail-updated` typed event 把 `HistoryItemPreviewPayload` 定向发送给 `preview-detail`，再调用 `show_history_preview_detail_window` 按该条记录的详情高度定位。分组 payload 继续使用 `history-preview-updated`；两个窗口不能复用同一事件名，否则应用级 listener 会让分组窗口误消费 item payload 并替换自身内容。`preview-detail` 继续复用 `HistoryDetailPanel`，并保持 `set_focusable(false)`。

`show_history_preview_detail_window` 必须保持分组窗口位置不变，并把详情窗口放在分组窗口左侧或右侧，二者始终相邻且互不覆盖。分组在主窗口左侧时详情优先位于分组更左侧；分组在主窗口右侧时详情优先位于分组更右侧。如果外侧越过屏幕工作区，则只把详情翻到分组另一侧，允许详情覆盖主界面，但不能覆盖或替代分组列表。即使两侧都无法完整容纳详情，也优先保持详情与分组的相邻关系，不通过水平钳制把两个 preview 窗口叠在一起。

详情的垂直锚点来自当前激活行的 `getBoundingClientRect().top`，并复用主界面单条详情的 `getItemPreviewAnchorTop` 内容区偏移；Rust 将这个逻辑坐标换算到分组窗口所在显示器的物理坐标，再做工作区钳制。这样在空间允许时，详情的内容区而不是标题顶边与 hover 行处于同一水平线。详情窗口使用与主界面单条详情相同的原生宽度，React 根容器不再在相邻侧保留透明 padding，保证详情表面与分组表面贴边且原生命中区域连续。

窗口关系统一使用分组窗口所在显示器的 Tauri 物理坐标计算。详情窗口即将移动到该显示器，因此其物理宽高也使用分组窗口的 scale factor 一次性确定，并以 `Size::Physical` 和 `Position::Physical` 应用；不能读取仍隐藏或刚 resize 的详情 `NSWindow.frame` 做二次校正，否则旧 frame 会把详情重新放回分组矩形并保留旧命中高度。React payload、窗口可见性和生命周期仍由现有 Tauri/React 状态流管理。

这条路径取代分组模式下的组合宽度/高度布局。`show_history_group_preview_with_detail_window`、组合网格样式和 `getGroupPreviewHeightWithDetail` 在确认无调用后移除，避免两套详情窗口模型继续并存。

备选方案是继续扩展同一个 `preview` 窗口并仅缩短内部详情面板，但窗口透明区域和原生命中矩形仍会继承分组高度，无法满足“独立界面”的交互与尺寸要求，因此不采用。

### 2. 分组高度以渲染内容测量为最终值

分组 payload 首次打开时仍可使用纯函数给出的紧凑估算值，避免等待 DOM 后窗口无法显示；`HistoryGroupPreviewWindow` 渲染后测量标题区和列表内容的自然高度，并通过带类型的 preview-size event 报告给主窗口 controller。controller 只在高度变化超过像素容差时调用专用的 `resize_history_preview_window`。该命令只调整高度并在工作区内钳制 Y，必须保留分组窗口当前 X，避免详情已打开后又把分组横向拉回主窗口旁并覆盖独立详情；首次显示时的 anchor、宽度需求和 request revision 防竞态逻辑继续由 `show_history_preview_window` 负责。

Rust 继续作为最终安全边界，把期望高度限制到最小预览高度和当前显示器工作区。若自然高度超过可用高度，窗口固定在工作区内，分组列表区域滚动，标题保持可见。测量以实际 DOM 为准，尺寸常量只作为首次显示的 fallback，避免 Tailwind 间距调整后再次出现公式漂移。

备选方案是继续同步维护 CSS 行高与 TypeScript 常量。它实现较简单，但样式重构、图片行或字体度量变化都可能再次产生空白，因此仅保留为 bootstrap 而非最终尺寸来源。

### 3. 详情高度统一走单条详情尺寸规则

主界面条目详情和分组 hover 详情都使用 `getItemPreviewHeight(item)` 计算期望高度，并使用 `getItemPreviewAnchorTop(rowTop)` 让详情内容区对齐触发行；Rust 的 preview 高度 clamp 继续处理显示器边界。切换 hover 项时先更新 `preview-detail` payload，再按新条目和新行锚点重新设置尺寸和位置；分组窗口本身不 resize。详情内容区在最大高度内滚动，标题和元信息区保持可见。

这比使用分组高度或“当前 hover 行偏移 + 详情高度”更符合详情自身的内容模型，也保证同一条记录从主界面或分组打开时得到一致的面板比例。

### 4. 删除动作由详情 shell 注入，后端事件作为数据真相

`HistoryDetailPanel` 保持无副作用的展示组件，通过现有 `headerAction` slot 接收一个共享的详情删除按钮组件。`HistoryItemPreviewWindow` 与 `HistoryPreviewDetailWindow` 分别注入同一按钮；`HistoryGroupPreviewWindow` 删除列表行按钮、`onDeleteItem` prop 和相关可见性样式。

删除仍调用现有 typed IPC `deleteHistoryItem(id)`。成功后立即隐藏当前详情窗口；Rust 后端发出的 `history-updated` 事件刷新主数据，主窗口 controller 再向打开的分组 preview 推送最新 payload。若分组变空则关闭整个 preview 家族，否则保留更新后的紧凑分组列表。这样不新增 Rust 数据命令，也不让详情窗口持有可漂移的完整历史副本。

备选方案是从详情窗口发一个“请求删除”事件，让 `preview` 窗口代为调用 command。该方案增加了一跳事件和失败回传协议，而现有删除 command 已经是可由任意窗口安全调用的服务封装，因此不采用。

### 5. preview 家族生命周期仍由统一命中和 dismissal 状态控制

`is_pointer_over_history_preview_window` 继续同时检查 `preview` 与 `preview-detail`。从分组列表移动到详情时不触发关闭；离开两个窗口后才按现有延迟关闭。选择复制、删除最后一项或主窗口隐藏时必须同时隐藏两个窗口，并保留 request revision 对迟到异步 show 的抑制。

## Risks / Trade-offs

- [Risk] 首次估算高度与 DOM 实测高度不同，窗口可能产生一次很小的尺寸调整 → 使用接近当前布局的 fallback、像素容差和单次稳定测量，避免循环 resize。
- [Risk] 字体、图片加载或主题切换会改变自然高度 → 使用 `ResizeObserver` 或等价的受控重新测量，并缓存最后已应用高度。
- [Risk] hover 快速切换时旧 payload 或旧 show promise 晚到，详情可能短暂显示错误条目 → 为详情更新沿用 preview request revision/token，并在完成显示前校验当前 active item id。
- [Risk] 隐藏的详情窗口仍保留上次所在显示器的 scale factor 或旧 frame → 始终以当前分组窗口所在显示器为目标，用同一 scale factor 同步设置详情物理尺寸与位置，不使用隐藏窗口旧 frame 参与最终几何计算。
- [Risk] 删除由 `preview-detail` 发起后，分组窗口短暂保留旧行 → 删除成功先隐藏详情并清除 active item，随后以 `history-updated` 推送为唯一刷新来源。
- [Trade-off] 两个透明原生窗口比单一组合窗口多一次 event/invoke 往返，但换来独立尺寸、正确命中区域和更清晰的组件职责。

## Migration Plan

1. 先补充尺寸计算、分组实测高度报告和独立详情生命周期测试。
2. 将分组 hover payload/显示路径切换到 `preview-detail`，保留主界面单条详情现有路径。
3. 把删除按钮注入两个详情 shell，并移除分组行删除入口。
4. 删除无调用的组合窗口 command、TS wrapper、组合布局样式与旧高度工具。
5. 运行前端定向测试、Rust window 单元测试和 `npm run check`；在 macOS 原生运行中验证截图对应的底部空白、跨窗口 hover、删除与屏幕边界场景。

回滚时可整体恢复组合窗口调用和旧分组行删除按钮；历史数据与设置格式没有迁移，回滚不需要数据处理。

## Open Questions

无。默认采用现有单条详情宽度、内容高度上下限、圆角和元信息布局，除非实现期的原生验证显示某个平台需要单独的最小高度修正。
