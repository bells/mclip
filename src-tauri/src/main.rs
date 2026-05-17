// 发布版 Windows 不显示额外控制台窗口，保持托盘工具的安静体验。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 实际应用入口在 lib.rs，方便单元测试复用核心逻辑。
    m_clip_lib::run()
}
