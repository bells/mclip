# 后续规格同步协调记录

2026-09-08。本文交付最终规则及同步顺序，未执行 sync 或 archive，也未修改旧 change 的 tasks/specs。

| 位置及原要求 | 后续同步后的最终规则 |
| --- | --- |
| `add-pinned-history-items/pinned-history` — Automatic retention protects bounded pins / Pin cap reached | 新增置顶按 `maxPinnedItems`（默认 10，5..=20）检查，不能保留“固定 100 新增上限”；100/600 仅说明旧数据兼容边界。已有 pins 与图片资源不按新 cap 裁剪。 |
| 同要求 / Unpinned history exceeds maximum、Unpin makes old entry eligible for trim | 保留普通历史独立裁剪、Unpin 后恢复普通保留规则。降低设置不能自动 Unpin。 |
| `pinned-history` — Desktop and CLI pin operations | 桌面 toggle 锁内执行，CLI 显式 set 幂等。共用结构化计数；CLI 读取选定历史旁的设置。保留 ID、含 pins 的 CLI index、`--pinned`、`--keep-pinned`。 |
| `pinned-history` — Backward-compatible pin metadata、Deterministic pinned ordering、Pin state survives deduplication、Explicit destructive pin behavior | 原要求与场景全部保留，包括只读不写回、最近置顶排序、重复复制保留置顶时间、显式删除/清空。 |
| `add-pinned-history-items/history-display` — Pinned section interaction / Compact visual boundary between pins and recent history | 保留细分隔线与无分区标题；取消“无每行 marker”的约束，主窗口序号槽使用被动 Pin 图标。隐藏普通数字仍保留图标。 |
| 同要求 / Detail action bar owns pin controls | 保留：只有详情标题栏提供 pin 操作，不增加行内按钮。 |
| 同要求 / Keyboard traversal with pins、Archive preview numbering ignores pin offsets、Search with pins | 保留可见顺序遍历、普通分组、分组局部编号。主窗口匹配后的普通项从 1 编号，数字键 1–9/0 选普通项，排除编辑/IME/修饰键/重复/弹窗/分组模式。 |
| `history-display` — Configurable Main Window Item Count、Configurable Archive Group Item Count | 保留默认主列表 10、分组 50、范围与普通计数约束；pins 不占显示配额。 |
| `refine-v0-2-0-interface` / Preferences 归类和主题 | 沿用最新历史页和即时串行保存；序号显示开关仍归外观。三语、主题 token 和非聚焦 preview 规则保留。 |
| `add-sensitive-content-protection` / CLI presentation、Agent schema | 原 JSON 数组、类型联合、默认敏感遮罩和 schema=2 保留；只用显式 `list --json --with-meta` 添加外层元数据。 |

后续获得明确 sync 请求时，先核对主规格有无新变动，再同步旧 pin 的非冲突规则与上表中的最终替代规则；随后合入本 change 的 `pin-limit-settings`、`cli-pin-limit-metadata`、`history-display` 三个 delta。机械地先后复制 delta 会留下固定 100 和禁止 marker 的矛盾，因此必须按 requirement 和 scenario 合并。最终严格校验，并搜索主规格确保旧规则不再描述当前新增行为。

旧原生任务、当前三平台原生任务和独立 release change 均保持各自证据边界。同步、归档、发布不能由本记录或自动化通过推断。
