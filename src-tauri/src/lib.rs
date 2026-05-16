mod clipboard;
mod history;
mod settings;
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

use crate::clipboard::{copy_to_clipboard, spawn_clipboard_watcher};
use crate::history::{clear_history, get_history};
use crate::settings::{get_settings, save_settings};
use crate::window::{
    adjust_window_height, configure_main_window, hide_main_window, set_group_preview_visible,
    toggle_main_window, WindowPlacement,
};

const SHOW_GUARD_MS: u64 = 450;
const TOGGLE_WINDOW_SHORTCUT: &str = "CommandOrControl+Shift+V";

#[tauri::command]
fn quit_app(app_handle: AppHandle) {
    app_handle.exit(0);
}

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

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |tray, event| {
            on_tray_event(tray.app_handle(), &event);

            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                protect_next_focus_loss(&show_guard_until);
                let _ = toggle_main_window(tray.app_handle(), WindowPlacement::Tray);
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

fn register_global_shortcuts(app: &App, show_guard_until: Arc<Mutex<Option<Instant>>>) {
    let result = app.global_shortcut().on_shortcut(
        TOGGLE_WINDOW_SHORTCUT,
        move |app_handle, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                protect_next_focus_loss(&show_guard_until);
                if let Err(error) = toggle_main_window(app_handle, WindowPlacement::Center) {
                    eprintln!("failed to toggle main window from shortcut: {error}");
                }
            }
        },
    );

    if let Err(error) = result {
        eprintln!("failed to register global shortcut {TOGGLE_WINDOW_SHORTCUT}: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let show_guard_until = Arc::new(Mutex::new(None::<Instant>));

    tauri::Builder::default()
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

                    if remaining_guard.is_zero() {
                        let _ = hide_main_window(window.app_handle());
                    }
                }
            }
        })
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![
            copy_to_clipboard,
            quit_app,
            get_settings,
            save_settings,
            get_history,
            clear_history,
            adjust_window_height,
            set_group_preview_visible
        ])
        .setup({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |app| {
                #[cfg(target_os = "macos")]
                {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    app.set_dock_visibility(false);
                }

                configure_main_window(app.handle());
                spawn_clipboard_watcher(app.handle().clone());
                register_global_shortcuts(app, Arc::clone(&show_guard_until));
                build_tray(app, show_guard_until)?;

                Ok(())
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use tauri_plugin_global_shortcut::Shortcut;

    use super::TOGGLE_WINDOW_SHORTCUT;

    #[test]
    fn toggle_window_shortcut_can_be_parsed() {
        assert!(Shortcut::from_str(TOGGLE_WINDOW_SHORTCUT).is_ok());
    }
}
