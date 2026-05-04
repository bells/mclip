use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_positioner::{on_tray_event, Position, WindowExt};
use tauri::{LogicalSize, Size};

const SHOW_GUARD_MS: u64 = 450;
const DEFAULT_MAX_HISTORY_COUNT: u32 = 50;
const MIN_MAX_HISTORY_COUNT: u32 = 10;
const MAX_MAX_HISTORY_COUNT: u32 = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub max_history_count: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            max_history_count: DEFAULT_MAX_HISTORY_COUNT,
        }
    }
}

impl AppSettings {
    fn sanitize(mut self) -> Self {
        self.max_history_count = self
            .max_history_count
            .clamp(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT);
        self
    }
}

// --- Commands ---

#[tauri::command]
fn copy_to_clipboard(content: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn get_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    load_settings(&app_handle)
}

#[tauri::command]
fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    persist_settings(&app_handle, settings)
}

#[tauri::command]
fn clear_history(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = history_path(&app_handle)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn adjust_window_height(app_handle: tauri::AppHandle, item_count: u32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        const HEADER_HEIGHT: f64 = 60.0;
        const FOOTER_HEIGHT: f64 = 140.0;
        const PER_ITEM_HEIGHT: f64 = 34.0;
        const EMPTY_STATE_HEIGHT: f64 = 120.0; // 新增：空状态下的内容高度
        const MAX_HEIGHT: f64 = 600.0;

        let calculated_height = if item_count == 0 {
            HEADER_HEIGHT + FOOTER_HEIGHT + EMPTY_STATE_HEIGHT
        } else {
            HEADER_HEIGHT + FOOTER_HEIGHT + (item_count as f64 * PER_ITEM_HEIGHT)
        };

        let target_height = calculated_height.min(MAX_HEIGHT);

        let _ = window.set_size(Size::Logical(LogicalSize {
            width: 320.0,
            height: target_height,
        }));
    }
    Ok(())
}

#[tauri::command]
fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = history_path(&app_handle)?;
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let list = serde_json::from_str::<Vec<String>>(&content).map_err(|e| e.to_string())?;
        Ok(list)
    } else {
        Ok(Vec::new())
    }
}

// --- Helpers ---

fn process_and_save_history(app_handle: &tauri::AppHandle, new_item: String) -> Result<Vec<String>, String> {
    let mut history = get_history(app_handle.clone())?;
    let settings = load_settings(app_handle)?;

    history.retain(|x| x != &new_item);
    history.insert(0, new_item);

    if history.len() > settings.max_history_count as usize {
        history.truncate(settings.max_history_count as usize);
    }

    let path = history_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(history)
}

fn settings_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(config_dir.join("settings.json"))
}

fn history_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(config_dir.join("history.json"))
}

fn load_settings(app_handle: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;
    let mut settings = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<AppSettings>(&content)
            .map_err(|e| e.to_string())?
            .sanitize()
    } else {
        AppSettings::default()
    };
    settings.launch_at_login = launch_agent_enabled(app_handle)?;
    Ok(settings)
}

fn persist_settings(app_handle: &tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let settings = settings.sanitize();
    sync_launch_at_login(app_handle, settings.launch_at_login)?;
    let path = settings_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    load_settings(app_handle)
}

fn launch_agent_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home_dir = app_handle.path().home_dir().map_err(|e| e.to_string())?;
    Ok(home_dir
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{}.plist", app_handle.config().identifier)))
}

fn launch_agent_enabled(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    { Ok(launch_agent_path(app_handle)?.exists()) }
    #[cfg(not(target_os = "macos"))]
    { let _ = app_handle; Ok(false) }
}

fn sync_launch_at_login(app_handle: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let plist_path = launch_agent_path(app_handle)?;
        if enabled {
            if let Some(parent) = plist_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let executable = std::env::current_exe().map_err(|e| e.to_string())?;
            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{program}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>"#,
                label = app_handle.config().identifier,
                program = executable.to_string_lossy().replace('&', "&amp;")
            );
            fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
        } else if plist_path.exists() {
            fs::remove_file(&plist_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let show_guard_until = Arc::new(Mutex::new(None::<Instant>));

    tauri::Builder::default()
        .on_window_event({
            let show_guard_until = Arc::clone(&show_guard_until);
            move |window, event| {
                if window.label() != "main" { return; }
                if let WindowEvent::Focused(false) = event {
                    let remaining_guard = show_guard_until
                        .lock()
                        .ok()
                        .and_then(|deadline| *deadline)
                        .map(|deadline| deadline.saturating_duration_since(Instant::now()))
                        .unwrap_or_default();
                    if remaining_guard.is_zero() {
                        let _ = window.hide();
                    }
                }
            }
        })
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            copy_to_clipboard,
            quit_app,
            get_settings,
            save_settings,
            get_history,
            clear_history,
            adjust_window_height
        ])
        .setup({
            let show_guard_until = Arc::clone(&show_guard_until);
            move |app| {
                #[cfg(target_os = "macos")]
                {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    app.set_dock_visibility(false);
                }

                if let Some(window) = app.get_webview_window("main") {
                    // 完美圆角修复：禁止系统自带阴影
                    let _ = window.set_shadow(false); 
                    
                    if let Some(monitor) = window.primary_monitor().ok().flatten() {
                        let scale_factor = monitor.scale_factor();
                        let screen_logical_size = monitor.size().to_logical::<f64>(scale_factor);
                        let _ = window.set_size(Size::Logical(LogicalSize {
                            width: 320.0,
                            height: screen_logical_size.height / 3.0,
                        }));
                    }
                }

                let handle = app.handle().clone();

                // 核心修复：启动时先读取当前剪贴板，防止将旧数据误判为新记录
                thread::spawn(move || {
                    let mut clipboard = Clipboard::new().expect("Failed to init clipboard");
                    let mut last_content = clipboard.get_text().unwrap_or_default();
                    
                    loop {
                        if let Ok(current_content) = clipboard.get_text() {
                            if !current_content.is_empty() && current_content != last_content {
                                last_content = current_content.clone();
                                if let Ok(updated_history) = process_and_save_history(&handle, last_content.clone()) {
                                    let _ = handle.emit("history-updated", updated_history);
                                }
                            }
                        }
                        thread::sleep(Duration::from_millis(500));
                    }
                });

                // Tray Setup
                let quit_i = MenuItem::with_id(app, "quit", "退出mclip", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event({
                        let show_guard_until = Arc::clone(&show_guard_until);
                        move |tray, event| {
                            on_tray_event(tray.app_handle(), &event);
                            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                                if let Ok(mut deadline) = show_guard_until.lock() {
                                    *deadline = Some(Instant::now() + Duration::from_millis(SHOW_GUARD_MS));
                                }
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.move_window_constrained(Position::TrayBottomCenter);
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                    })
                    .on_menu_event(|app, event| {
                        if event.id == "quit" { app.exit(0); }
                    })
                    .build(app)?;

                Ok(())
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}