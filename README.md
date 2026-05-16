# mclip

`mclip` 是一个基于 Tauri 2、React 19 和 Rust 的轻量剪贴板历史应用，目标平台是 macOS 和 Windows。

## 当前能力

- 托盘驻留，点击图标显示或隐藏主窗口
- 支持 `Ctrl/Cmd + Shift + V` 全局快捷键唤起或隐藏主窗口
- 轮询监听系统剪贴板文本变化
- 去重保存历史，默认显示最新 10 条，并按每 10 条分组浏览
- 支持方向键选择、回车回填、`Esc` 收起窗口、`Ctrl/Cmd + F` 聚焦搜索
- 持久化偏好设置与历史记录
- macOS 与 Windows 都支持登录时启动

## 项目结构

```text
.
├── src
│   ├── components        # 前端界面组件
│   ├── hooks             # 前端状态与交互逻辑
│   ├── lib               # Tauri API 封装
│   └── utils             # 前端纯函数
├── src-tauri
│   ├── capabilities      # Tauri 权限能力配置
│   └── src
│       ├── clipboard.rs  # 剪贴板访问与监听
│       ├── history.rs    # 历史记录持久化与去重
│       ├── settings.rs   # 设置读写与登录时启动
│       ├── window.rs     # 主窗口尺寸与展示行为
│       └── lib.rs        # Tauri 应用装配入口
└── .github/workflows     # CI 与发布流程
```

## 本地开发

```bash
npm ci
npm run tauri:dev
```

## 常用脚本

```bash
npm run build        # 构建前端资源
npm run check        # 前端构建 + Rust fmt/test/check
npm run tauri:build  # 打包桌面应用
```

## 工程约定

- 前端尽量把 UI、状态管理和 Tauri 调用分层
- Rust 端优先拆分纯逻辑模块，避免所有行为集中在 `lib.rs`
- 历史记录和设置都写入系统配置目录，不进入仓库

## 后续建议

- 从轮询升级到更稳定的系统级剪贴板监听
- 支持图片、HTML、文件等更多剪贴板类型
