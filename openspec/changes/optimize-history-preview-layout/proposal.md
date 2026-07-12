## Why

历史分组预览目前按固定公式估算窗口高度，容易在列表底部留下明显空白；分组中的单条记录又把删除入口放在列表行，而 hover 详情与分组窗口共用高度，导致详情页面显得过高且与主界面单条详情不一致。需要统一单条详情的交互模型，并让分组与详情各自按内容获得合适尺寸。

## What Changes

- 让历史分组预览按实际列表内容确定紧凑高度，在项目较多或屏幕空间不足时保留滚动与工作区边界保护。
- 从历史分组列表行移除单条删除按钮，把删除动作放入该条记录的详情标题区，与主界面单条详情保持一致。
- 将分组 hover 详情作为真正独立的详情界面展示，不再为了详情内容扩展分组窗口或继承分组窗口高度。
- 统一主界面单条详情与分组 hover 详情的详情面板结构、删除动作和内容驱动尺寸规则，同时保留分组列表与单条详情各自独立的窗口 shell。
- 补充前端尺寸/交互回归测试以及 Rust 窗口尺寸、定位和屏幕边界测试。

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `history-display`: 增加历史分组紧凑自适应高度、分组详情独立尺寸，以及删除入口归一到详情界面的行为要求。

## Impact

- 前端 preview 组件与状态流：`HistoryPreviewWindow`、`HistoryGroupPreviewWindow`、`HistoryPreviewDetailWindow`、`HistoryItemPreviewWindow`、`HistoryDetailPanel`。
- 前端 Tauri IPC/event 封装、preview 尺寸计算与 Tailwind 样式映射。
- Rust/Tauri preview 与 preview-detail 窗口的尺寸、定位、命中及显示隐藏逻辑。
- 相关前端 Node 测试与 `src-tauri/src/window.rs` 单元测试；不新增第三方依赖，不改变历史数据格式。
