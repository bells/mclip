//! Tauri 应用入口与全局生命周期管理。
//! 这里负责托盘、快捷键、窗口焦点规则以及所有前端可调用命令的注册。

pub mod agent_cli;
mod auto_paste;
pub mod cli_install;
mod clipboard;
mod diagnostics;
mod history;
mod settings;
mod source_app;
mod storage;
mod window;

use std::io;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_positioner::on_tray_event;

use crate::auto_paste::{remember_current_paste_target, AutoPasteTargetState};
use crate::cli_install::{get_cli_install_status, install_cli};
use crate::clipboard::{
    copy_history_item, get_image_base64, paste_current_clipboard, spawn_clipboard_watcher,
};
use crate::diagnostics::{
    copy_diagnostic_report, initialize_diagnostics, log_error, log_info, open_issue_report,
    open_logs_dir, open_project_link, write_client_log,
};
use crate::history::{clear_history, delete_history_item, get_history};
use crate::settings::{get_settings, save_settings};
use crate::window::{
    adjust_window_height, configure_main_window, get_history_preview_pointer_position,
    hide_history_preview_detail_window, hide_history_preview_window, hide_main_window,
    is_pointer_over_history_preview_window, is_pointer_over_preview_window, show_about_window,
    show_history_group_preview_with_detail_window, show_history_preview_detail_window,
    show_history_preview_window, show_main_window, show_preferences_window, toggle_main_window,
    TrayWindowAnchor, WindowPlacement,
};

const SHOW_GUARD_MS: u64 = 450;
const TOGGLE_WINDOW_SHORTCUT: &str = "CommandOrControl+Shift+V";
const TRAY_ICON_ID: &str = "main";
#[cfg(any(target_os = "macos", test))]
const TRAY_POSITION_AUTOSAVE_NAME: &str = "com.watson.mclip.tray.main";
const TRAY_TOOLTIP: &str = "更好用的剪贴板工具mclip";

#[tauri::command]
fn quit_app(app_handle: AppHandle) {
    log_info(&app_handle, "app", "mclip exiting by user request");
    app_handle.exit(0);
}

// Opening the window from tray/shortcut briefly changes focus on macOS and
// Windows. This guard prevents the just-opened popover from hiding itself.
fn protect_next_focus_loss(show_guard_until: &Arc<Mutex<Option<Instant>>>) {
    if let Ok(mut deadline) = show_guard_until.lock() {
        *deadline = Some(Instant::now() + Duration::from_millis(SHOW_GUARD_MS));
    }
}

fn build_tray(
    app: &App,
    show_guard_until: Arc<Mutex<Option<Instant>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "退出 mclip", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit_item])?;

    let icon = app
        .default_window_icon()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing default window icon"))?
        .clone();

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .tooltip(TRAY_TOOLTIP)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |tray, event| {
            on_tray_event(tray.app_handle(), &event);

            if let TrayIconEvent::Click {
                position,
                rect,
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                remember_current_paste_target(tray.app_handle());
                protect_next_focus_loss(&show_guard_until);
                // Use this click's rect directly; the positioner tray cache can
                // produce a screen-level placement when the tray rect is stale.
                let _ = toggle_main_window(
                    tray.app_handle(),
                    WindowPlacement::Tray(TrayWindowAnchor::from_event(position, rect)),
                );
            }
        })
        .on_menu_event(|app, event| {
            if event.id == "quit" {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}

fn configure_tray_position_persistence(app_handle: &AppHandle) {
    if let Err(error) = set_tray_position_autosave_name(app_handle) {
        log_error(
            app_handle,
            "tray",
            &format!("failed to configure tray position persistence: {error}"),
        );
    }
}

#[cfg(target_os = "macos")]
fn set_tray_position_autosave_name(app_handle: &AppHandle) -> Result<(), String> {
    let Some(tray) = app_handle.tray_by_id(TRAY_ICON_ID) else {
        return Err("failed to find tray icon".to_string());
    };

    // macOS does not expose a public API to force a status-item order. A stable
    // autosave name lets the system restore the user's menu bar placement.
    let did_configure = tray
        .with_inner_tray_icon(|tray_icon| {
            let Some(status_item) = tray_icon.ns_status_item() else {
                return false;
            };

            let autosave_name = objc2_foundation::NSString::from_str(TRAY_POSITION_AUTOSAVE_NAME);
            status_item.setAutosaveName(Some(&autosave_name));
            true
        })
        .map_err(|error| error.to_string())?;

    if did_configure {
        Ok(())
    } else {
        Err("macOS status item is unavailable".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
fn set_tray_position_autosave_name(_app_handle: &AppHandle) -> Result<(), String> {
    Ok(())
}

fn main_window_placement_from_tray(app_handle: &AppHandle) -> WindowPlacement {
    let Some(tray) = app_handle.tray_by_id(TRAY_ICON_ID) else {
        log_error(
            app_handle,
            "tray",
            "failed to find tray icon for shortcut placement",
        );
        return WindowPlacement::Center;
    };

    match tray.rect() {
        Ok(Some(rect)) => TrayWindowAnchor::from_rect(rect)
            .map(WindowPlacement::Tray)
            .unwrap_or_else(|| {
                log_error(
                    app_handle,
                    "tray",
                    "tray rect was empty; falling back to centered shortcut placement",
                );
                WindowPlacement::Center
            }),
        Ok(None) => {
            log_error(
                app_handle,
                "tray",
                "tray rect was unavailable; falling back to centered shortcut placement",
            );
            WindowPlacement::Center
        }
        Err(error) => {
            log_error(
                app_handle,
                "tray",
                &format!("failed to read tray rect for shortcut placement: {error}"),
            );
            WindowPlacement::Center
        }
    }
}

fn register_global_shortcuts(app: &App, show_guard_until: Arc<Mutex<Option<Instant>>>) {
    let result = app.global_shortcut().on_shortcut(
        TOGGLE_WINDOW_SHORTCUT,
        move |app_handle, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                remember_current_paste_target(app_handle);
                protect_next_focus_loss(&show_guard_until);
                let placement = main_window_placement_from_tray(app_handle);
                if let Err(error) = toggle_main_window(app_handle, placement) {
                    log_error(
                        app_handle,
                        "shortcut",
                        &format!("failed to toggle main window from shortcut: {error}"),
                    );
                }
            }
        },
    );

    if let Err(error) = result {
        log_error(
            app.handle(),
            "shortcut",
            &format!("failed to register global shortcut {TOGGLE_WINDOW_SHORTCUT}: {error}"),
        );
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SingleInstanceLaunchAction {
    ShowMainWindow,
}

fn single_instance_launch_action(_args: &[String], _cwd: &str) -> SingleInstanceLaunchAction {
    SingleInstanceLaunchAction::ShowMainWindow
}

fn handle_single_instance_launch(
    app_handle: &AppHandle,
    args: &[String],
    cwd: &str,
    show_guard_until: &Arc<Mutex<Option<Instant>>>,
) {
    match single_instance_launch_action(args, cwd) {
        SingleInstanceLaunchAction::ShowMainWindow => {
            remember_current_paste_target(app_handle);
            log_info(
                app_handle,
                "app",
                &format!(
                    "reused existing mclip instance after repeated launch; cwd={cwd}; args={}",
                    args.len()
                ),
            );
            protect_next_focus_loss(show_guard_until);

            if let Err(error) =
                show_main_window(app_handle, main_window_placement_from_tray(app_handle))
            {
                log_error(
                    app_handle,
                    "app",
                    &format!("failed to show main window after repeated launch: {error}"),
                );
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let show_guard_until = Arc::new(Mutex::new(None::<Instant>));

    tauri::Builder::default()
        .manage(AutoPasteTargetState::default())
        .on_window_event({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |window, event| {
                if window.label() != "main" {
                    return;
                }

                if let WindowEvent::Focused(false) = event {
                    let remaining_guard = show_guard_until
                        .lock()
                        .ok()
                        .and_then(|deadline| *deadline)
                        .map(|deadline| deadline.saturating_duration_since(Instant::now()))
                        .unwrap_or_default();

                    let is_pointer_over_preview =
                        is_pointer_over_preview_window(window.app_handle()).unwrap_or(false);

                    // Moving from the main popover into the preview transfers
                    // focus away from the main window. Keep both windows alive
                    // while the pointer is over the preview.
                    if remaining_guard.is_zero() && !is_pointer_over_preview {
                        let _ = hide_main_window(window.app_handle());
                    }
                }
            }
        })
        .plugin(tauri_plugin_single_instance::init({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |app_handle, args, cwd| {
                handle_single_instance_launch(app_handle, &args, &cwd, &show_guard_until);
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![
            copy_history_item,
            paste_current_clipboard,
            get_image_base64,
            quit_app,
            get_settings,
            save_settings,
            get_cli_install_status,
            install_cli,
            get_history,
            clear_history,
            delete_history_item,
            adjust_window_height,
            show_history_preview_window,
            show_history_group_preview_with_detail_window,
            show_history_preview_detail_window,
            hide_history_preview_window,
            hide_history_preview_detail_window,
            show_about_window,
            show_preferences_window,
            is_pointer_over_history_preview_window,
            get_history_preview_pointer_position,
            open_logs_dir,
            copy_diagnostic_report,
            open_issue_report,
            open_project_link,
            write_client_log
        ])
        .setup({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |app| {
                #[cfg(target_os = "macos")]
                {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    app.set_dock_visibility(false);
                }

                initialize_diagnostics(app.handle())?;
                configure_main_window(app.handle());
                spawn_clipboard_watcher(app.handle().clone());
                register_global_shortcuts(app, Arc::clone(&show_guard_until));
                build_tray(app, show_guard_until)?;
                configure_tray_position_persistence(app.handle());
                log_info(app.handle(), "app", "mclip started");

                Ok(())
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use serde_json::Value;
    use tauri_plugin_global_shortcut::Shortcut;

    use super::{
        single_instance_launch_action, SingleInstanceLaunchAction, TOGGLE_WINDOW_SHORTCUT,
        TRAY_POSITION_AUTOSAVE_NAME,
    };

    #[test]
    fn toggle_window_shortcut_can_be_parsed() {
        assert!(Shortcut::from_str(TOGGLE_WINDOW_SHORTCUT).is_ok());
    }

    #[test]
    fn repeated_launch_requests_existing_window_to_show() {
        let args = vec!["mclip".to_string()];

        assert_eq!(
            single_instance_launch_action(&args, "C:\\Users\\Watson"),
            SingleInstanceLaunchAction::ShowMainWindow
        );
    }

    #[test]
    fn csp_allows_data_url_image_previews() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let security = &config["app"]["security"];

        for key in ["csp", "devCsp"] {
            let csp = security[key].as_str().unwrap();
            let img_src = csp
                .split(';')
                .map(str::trim)
                .find(|directive| directive.starts_with("img-src "))
                .unwrap_or_else(|| panic!("{key} is missing img-src"));

            assert!(
                img_src.split_whitespace().any(|source| source == "data:"),
                "{key} img-src must allow data: because ImageThumb renders PNG previews as data URLs"
            );
        }
    }

    #[test]
    fn macos_bundle_is_configured_as_agent_app() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();

        assert_eq!(
            config["bundle"]["macOS"]["infoPlist"].as_str(),
            Some("Info.plist"),
            "macOS bundles must merge src-tauri/Info.plist so mclip starts without a Dock icon"
        );

        let plist_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("Info.plist");
        let plist = std::fs::read_to_string(&plist_path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", plist_path.display()));

        assert!(
            plist.contains("<key>LSUIElement</key>") && plist.contains("<true/>"),
            "Info.plist must declare LSUIElement=true so macOS treats mclip as a menu bar app"
        );
    }

    #[test]
    fn tray_position_autosave_name_is_stable() {
        assert_eq!(TRAY_POSITION_AUTOSAVE_NAME, "com.watson.mclip.tray.main");
    }
}
