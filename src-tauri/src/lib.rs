//! Tauri 应用入口与全局生命周期管理。
//! 这里负责托盘、快捷键、窗口焦点规则以及所有前端可调用命令的注册。

pub mod agent_cli;
mod auto_paste;
mod auxiliary_window_contract;
pub mod auxiliary_windows;
pub mod cli_install;
mod clipboard;
mod desktop_state;
mod diagnostics;
mod history;
mod image_cache;
pub mod performance;
mod settings;
mod source_app;
mod storage;
mod window;

use std::io;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_positioner::on_tray_event;

use crate::auto_paste::{remember_current_paste_target, AutoPasteTargetState};
use crate::auxiliary_window_contract::AuxiliaryWindowRegistry;
use crate::auxiliary_windows::{ensure_auxiliary_window, mark_auxiliary_window_ready};
use crate::cli_install::{get_cli_install_status, install_cli};
use crate::clipboard::{
    copy_history_item, get_auto_paste_permission_status, open_auto_paste_permission_settings,
    paste_current_clipboard, spawn_clipboard_watcher,
};
use crate::desktop_state::DesktopStateRepository;
use crate::diagnostics::{
    copy_diagnostic_report, initialize_diagnostics, log_error, log_info, open_issue_report,
    open_logs_dir, open_project_link, write_client_log,
};
use crate::history::{
    clear_history, delete_history_item, get_history_snapshot, history_assets_dir_for_history_path,
    history_path,
};
use crate::image_cache::{get_image_base64, get_image_cache_stats, ImageDataCache};
use crate::performance::{
    is_performance_mode_enabled, record_frontend_performance, record_rust_milestone,
    PerformanceAutomationAction, PerformanceMilestoneName, PerformanceOutcome, PerformanceRecorder,
    PERFORMANCE_AUTOMATION_EVENT, PERFORMANCE_CLOSE_VIEWER_ARGUMENT,
    PERFORMANCE_OPEN_VIEWER_ARGUMENT, PERFORMANCE_QUIT_ARGUMENT,
};
use crate::settings::{
    get_settings, load_settings, resolve_app_language, AppLanguage, AppSettings, MenuBarIconStyle,
    ResolvedAppLanguage,
};
#[cfg(target_os = "macos")]
use crate::window::macos_tray_window_anchor;
use crate::window::{
    adjust_window_height, adjust_window_height_to_content, close_image_viewer,
    configure_main_window, get_history_preview_pointer_position,
    hide_history_preview_detail_window, hide_history_preview_window, hide_main_window,
    is_image_viewer_visible, is_pointer_over_history_preview_window,
    is_pointer_over_preview_window, resize_history_preview_window, show_about_window,
    show_history_preview_detail_window, show_history_preview_window, show_image_viewer,
    show_main_window, show_preferences_window, toggle_image_viewer_maximize, toggle_main_window,
    TrayWindowAnchor, WindowPlacement, IMAGE_VIEWER_WINDOW_LABEL,
};

const SHOW_GUARD_MS: u64 = 450;
const TOGGLE_WINDOW_SHORTCUT: &str = "CommandOrControl+Shift+V";
const TRAY_ICON_ID: &str = "main";
const APP_MENU_BAR_ICON_BYTES: &[u8] = include_bytes!("../../app-icon.png");
const LIGHT_MENU_BAR_ICON_BYTES: &[u8] = include_bytes!("../icons/menu-bar-icon-light.png");
const M_MENU_BAR_ICON_BYTES: &[u8] = include_bytes!("../icons/menu-bar-icon-m.png");
#[cfg(any(target_os = "macos", test))]
const TRAY_POSITION_AUTOSAVE_NAME: &str = "com.watson.mclip.tray.main";

fn tray_tooltip(language: &AppLanguage) -> &'static str {
    match resolve_app_language(language) {
        ResolvedAppLanguage::ZhCn => "更好用的剪贴板工具 mclip",
        ResolvedAppLanguage::En => "A better clipboard history tool, mclip",
    }
}

#[tauri::command]
fn quit_app(app_handle: AppHandle) {
    log_info(&app_handle, "app", "mclip exiting by user request");
    app_handle.exit(0);
}

#[tauri::command]
async fn save_settings(
    app_handle: AppHandle,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    let blocking_handle = app_handle.clone();
    let saved_settings = tauri::async_runtime::spawn_blocking(move || {
        settings::save_settings(blocking_handle, settings)
    })
    .await
    .map_err(|error| error.to_string())??;
    configure_tray_tooltip(&app_handle, &saved_settings.language);
    configure_tray_icon(&app_handle, &saved_settings.menu_bar_icon_style);
    Ok(saved_settings)
}

// Opening the window from tray/shortcut briefly changes focus on macOS and
// Windows. This guard prevents the just-opened popover from hiding itself.
fn protect_next_focus_loss(show_guard_until: &Arc<Mutex<Option<Instant>>>) {
    if let Ok(mut deadline) = show_guard_until.lock() {
        *deadline = Some(Instant::now() + Duration::from_millis(SHOW_GUARD_MS));
    }
}

fn should_hide_main_window_on_focus_loss(
    focus_loss_guard_active: bool,
    is_pointer_over_preview: bool,
    image_viewer_visible: bool,
) -> bool {
    !focus_loss_guard_active && !is_pointer_over_preview && !image_viewer_visible
}

fn build_tray(
    app: &App,
    show_guard_until: Arc<Mutex<Option<Instant>>>,
    startup_settings: &AppSettings,
) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "退出 mclip", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit_item])?;

    let default_icon = app
        .default_window_icon()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing default window icon"))?
        .clone();
    let icon = menu_bar_icon(&startup_settings.menu_bar_icon_style).unwrap_or_else(|error| {
        log_error(
            app.handle(),
            "tray",
            &format!("failed to load configured tray icon: {error}"),
        );
        default_icon
    });

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .icon_as_template(menu_bar_icon_is_template(
            &startup_settings.menu_bar_icon_style,
        ))
        .tooltip(tray_tooltip(&startup_settings.language))
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
                let event_anchor = TrayWindowAnchor::from_event(position, rect);
                #[cfg(target_os = "macos")]
                let anchor = macos_tray_window_anchor(tray, position, rect).unwrap_or_else(|error| {
                    log_error(
                        tray.app_handle(),
                        "tray",
                        &format!(
                            "failed to resolve native macOS tray geometry; using event coordinates: {error}"
                        ),
                    );
                    event_anchor
                });
                #[cfg(not(target_os = "macos"))]
                let anchor = event_anchor;

                #[cfg(all(target_os = "macos", debug_assertions))]
                log_info(
                    tray.app_handle(),
                    "tray",
                    &format!("resolved native tray click anchor: {anchor:?}"),
                );

                if let Err(error) = toggle_main_window(
                    tray.app_handle(),
                    WindowPlacement::Tray(anchor),
                ) {
                    log_error(
                        tray.app_handle(),
                        "tray",
                        &format!("failed to toggle main window from tray: {error}"),
                    );
                }
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

fn configure_tray_tooltip(app_handle: &AppHandle, language: &AppLanguage) {
    if let Err(error) = set_tray_tooltip(app_handle, language) {
        log_error(
            app_handle,
            "tray",
            &format!("failed to update tray tooltip: {error}"),
        );
    }
}

fn configure_tray_icon(app_handle: &AppHandle, style: &MenuBarIconStyle) {
    if let Err(error) = set_tray_icon(app_handle, style) {
        log_error(
            app_handle,
            "tray",
            &format!("failed to update tray icon: {error}"),
        );
    }
}

fn menu_bar_icon_bytes(style: &MenuBarIconStyle) -> &'static [u8] {
    match style {
        MenuBarIconStyle::AppIcon => APP_MENU_BAR_ICON_BYTES,
        MenuBarIconStyle::Light => LIGHT_MENU_BAR_ICON_BYTES,
        MenuBarIconStyle::M => M_MENU_BAR_ICON_BYTES,
    }
}

fn menu_bar_icon(style: &MenuBarIconStyle) -> Result<Image<'static>, String> {
    Image::from_bytes(menu_bar_icon_bytes(style)).map_err(|error| error.to_string())
}

fn menu_bar_icon_is_template(style: &MenuBarIconStyle) -> bool {
    matches!(style, MenuBarIconStyle::Light | MenuBarIconStyle::M)
}

fn set_tray_icon(app_handle: &AppHandle, style: &MenuBarIconStyle) -> Result<(), String> {
    let Some(tray) = app_handle.tray_by_id(TRAY_ICON_ID) else {
        return Err("failed to find tray icon".to_string());
    };

    tray.set_icon(Some(menu_bar_icon(style)?))
        .map_err(|error| error.to_string())?;
    tray.set_icon_as_template(menu_bar_icon_is_template(style))
        .map_err(|error| error.to_string())
}

fn set_tray_tooltip(app_handle: &AppHandle, language: &AppLanguage) -> Result<(), String> {
    let Some(tray) = app_handle.tray_by_id(TRAY_ICON_ID) else {
        return Err("failed to find tray icon".to_string());
    };

    tray.set_tooltip(Some(tray_tooltip(language)))
        .map_err(|error| error.to_string())
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
    Performance(PerformanceAutomationAction),
    QuitPerformanceRun,
}

fn single_instance_launch_action(
    args: &[String],
    _cwd: &str,
    performance_mode_enabled: bool,
) -> SingleInstanceLaunchAction {
    if performance_mode_enabled {
        match args {
            [_, action] if action == PERFORMANCE_OPEN_VIEWER_ARGUMENT => {
                return SingleInstanceLaunchAction::Performance(
                    PerformanceAutomationAction::OpenViewer,
                );
            }
            [_, action] if action == PERFORMANCE_CLOSE_VIEWER_ARGUMENT => {
                return SingleInstanceLaunchAction::Performance(
                    PerformanceAutomationAction::CloseViewer,
                );
            }
            [_, action] if action == PERFORMANCE_QUIT_ARGUMENT => {
                return SingleInstanceLaunchAction::QuitPerformanceRun;
            }
            _ => {}
        }
    }

    SingleInstanceLaunchAction::ShowMainWindow
}

fn handle_single_instance_launch(
    app_handle: &AppHandle,
    args: &[String],
    cwd: &str,
    show_guard_until: &Arc<Mutex<Option<Instant>>>,
) {
    let performance_mode_enabled = app_handle.state::<PerformanceRecorder>().is_enabled();

    match single_instance_launch_action(args, cwd, performance_mode_enabled) {
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
        SingleInstanceLaunchAction::Performance(PerformanceAutomationAction::OpenViewer) => {
            if let Err(error) = app_handle.emit_to(
                "preview",
                PERFORMANCE_AUTOMATION_EVENT,
                PerformanceAutomationAction::OpenViewer,
            ) {
                log_error(
                    app_handle,
                    "performance",
                    &format!("failed to request performance viewer open: {error}"),
                );
            }
        }
        SingleInstanceLaunchAction::Performance(PerformanceAutomationAction::CloseViewer) => {
            if let Err(error) = close_image_viewer(app_handle.clone()) {
                log_error(
                    app_handle,
                    "performance",
                    &format!("failed to close performance viewer: {error}"),
                );
            }
        }
        SingleInstanceLaunchAction::QuitPerformanceRun => app_handle.exit(0),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let show_guard_until = Arc::new(Mutex::new(None::<Instant>));
    let performance_recorder =
        PerformanceRecorder::from_env().expect("failed to initialize performance recorder");
    record_rust_milestone(
        &performance_recorder,
        PerformanceMilestoneName::ProcessEntry,
        None,
        None,
        PerformanceOutcome::Success,
    );

    tauri::Builder::default()
        .manage(AutoPasteTargetState::default())
        .manage(AuxiliaryWindowRegistry::default())
        .manage(performance_recorder)
        .on_window_event({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |window, event| {
                if matches!(event, WindowEvent::Destroyed) {
                    window
                        .state::<AuxiliaryWindowRegistry>()
                        .remove_label(window.label());
                }

                if window.label() == IMAGE_VIEWER_WINDOW_LABEL {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = close_image_viewer(window.app_handle().clone());
                    }
                    return;
                }

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
                    let image_viewer_visible =
                        is_image_viewer_visible(window.app_handle()).unwrap_or(false);

                    // Moving from the main popover into the preview transfers
                    // focus away from the main window. Keep the main window
                    // alive while the pointer is over preview or the focused
                    // image viewer is presenting the same history detail.
                    if should_hide_main_window_on_focus_loss(
                        !remaining_guard.is_zero(),
                        is_pointer_over_preview,
                        image_viewer_visible,
                    ) {
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
            open_auto_paste_permission_settings,
            get_auto_paste_permission_status,
            get_image_base64,
            get_image_cache_stats,
            quit_app,
            get_settings,
            save_settings,
            get_cli_install_status,
            install_cli,
            get_history_snapshot,
            clear_history,
            delete_history_item,
            adjust_window_height,
            adjust_window_height_to_content,
            show_history_preview_window,
            resize_history_preview_window,
            show_history_preview_detail_window,
            hide_history_preview_window,
            hide_history_preview_detail_window,
            show_image_viewer,
            toggle_image_viewer_maximize,
            close_image_viewer,
            show_about_window,
            show_preferences_window,
            is_pointer_over_history_preview_window,
            get_history_preview_pointer_position,
            open_logs_dir,
            copy_diagnostic_report,
            open_issue_report,
            open_project_link,
            write_client_log,
            is_performance_mode_enabled,
            record_frontend_performance,
            ensure_auxiliary_window,
            mark_auxiliary_window_ready
        ])
        .setup({
            let show_guard_until = Arc::clone(&show_guard_until);

            move |app| {
                record_rust_milestone(
                    &app.state::<PerformanceRecorder>(),
                    PerformanceMilestoneName::SetupStart,
                    None,
                    None,
                    PerformanceOutcome::Success,
                );
                #[cfg(target_os = "macos")]
                {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    app.set_dock_visibility(false);
                }

                let settings_handle = app.handle().clone();
                let settings_loader = std::thread::spawn(move || load_settings(&settings_handle));

                initialize_diagnostics(app.handle())?;
                configure_main_window(app.handle());
                register_global_shortcuts(app, Arc::clone(&show_guard_until));

                let startup_settings = settings_loader
                    .join()
                    .map_err(|_| std::io::Error::other("settings loader thread panicked"))?
                    .unwrap_or_else(|error| {
                        log_error(
                            app.handle(),
                            "settings",
                            &format!("failed to initialize desktop settings state: {error}"),
                        );
                        AppSettings::default()
                    });
                let desktop_history_path =
                    history_path(app.handle()).map_err(std::io::Error::other)?;
                let image_cache = ImageDataCache::new(
                    history_assets_dir_for_history_path(&desktop_history_path).join("images"),
                );
                app.manage(image_cache.clone());
                let repository = DesktopStateRepository::for_app(
                    desktop_history_path,
                    startup_settings.clone(),
                    image_cache,
                );
                app.manage(repository);

                spawn_clipboard_watcher(app.handle().clone());
                build_tray(app, show_guard_until, &startup_settings)?;
                configure_tray_position_persistence(app.handle());
                record_rust_milestone(
                    &app.state::<PerformanceRecorder>(),
                    PerformanceMilestoneName::TrayReady,
                    None,
                    None,
                    PerformanceOutcome::Success,
                );
                for label in ["preview", "preview-detail"] {
                    let app_handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) =
                            auxiliary_windows::ensure_auxiliary_window_ready(&app_handle, label)
                                .await
                        {
                            log_error(
                                &app_handle,
                                "window",
                                &format!("failed to warm auxiliary window {label}: {error}"),
                            );
                        }
                    });
                }
                log_info(app.handle(), "app", "mclip started");

                #[cfg(debug_assertions)]
                if std::env::var("MCLIP_SMOKE_WINDOW").as_deref() == Ok("preferences") {
                    tauri::async_runtime::spawn(show_preferences_window(app.handle().clone()));
                }

                Ok(())
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use crate::settings::{AppLanguage, MenuBarIconStyle};

    use serde_json::Value;
    use tauri_plugin_global_shortcut::Shortcut;

    use super::{
        menu_bar_icon, menu_bar_icon_is_template, should_hide_main_window_on_focus_loss,
        single_instance_launch_action, tray_tooltip, SingleInstanceLaunchAction,
        TOGGLE_WINDOW_SHORTCUT, TRAY_POSITION_AUTOSAVE_NAME,
    };
    use crate::auxiliary_window_contract::{auxiliary_window_descriptor, LogicalWindowSize};
    use crate::performance::{
        PerformanceAutomationAction, PERFORMANCE_CLOSE_VIEWER_ARGUMENT,
        PERFORMANCE_OPEN_VIEWER_ARGUMENT, PERFORMANCE_QUIT_ARGUMENT,
    };

    #[test]
    fn toggle_window_shortcut_can_be_parsed() {
        assert!(Shortcut::from_str(TOGGLE_WINDOW_SHORTCUT).is_ok());
    }

    #[test]
    fn repeated_launch_requests_existing_window_to_show() {
        let args = vec!["mclip".to_string()];

        assert_eq!(
            single_instance_launch_action(&args, "C:\\Users\\Watson", false),
            SingleInstanceLaunchAction::ShowMainWindow
        );
    }

    #[test]
    fn performance_actions_require_the_enabled_recorder_and_exact_allowlisted_argument() {
        let open_args = vec![
            "mclip".to_string(),
            PERFORMANCE_OPEN_VIEWER_ARGUMENT.to_string(),
        ];
        let close_args = vec![
            "mclip".to_string(),
            PERFORMANCE_CLOSE_VIEWER_ARGUMENT.to_string(),
        ];
        let quit_args = vec!["mclip".to_string(), PERFORMANCE_QUIT_ARGUMENT.to_string()];

        assert_eq!(
            single_instance_launch_action(&open_args, "/tmp", true),
            SingleInstanceLaunchAction::Performance(PerformanceAutomationAction::OpenViewer)
        );
        assert_eq!(
            single_instance_launch_action(&close_args, "/tmp", true),
            SingleInstanceLaunchAction::Performance(PerformanceAutomationAction::CloseViewer)
        );
        assert_eq!(
            single_instance_launch_action(&quit_args, "/tmp", true),
            SingleInstanceLaunchAction::QuitPerformanceRun
        );
        assert_eq!(
            single_instance_launch_action(&open_args, "/tmp", false),
            SingleInstanceLaunchAction::ShowMainWindow
        );

        let content_args = vec![
            "mclip".to_string(),
            PERFORMANCE_OPEN_VIEWER_ARGUMENT.to_string(),
            "clipboard-content".to_string(),
        ];
        let path_args = vec![
            "mclip".to_string(),
            "--mclip-performance-action=open-viewer=/tmp/image.png".to_string(),
        ];
        assert_eq!(
            single_instance_launch_action(&content_args, "/tmp", true),
            SingleInstanceLaunchAction::ShowMainWindow
        );
        assert_eq!(
            single_instance_launch_action(&path_args, "/tmp", true),
            SingleInstanceLaunchAction::ShowMainWindow
        );
    }

    #[test]
    fn visible_image_viewer_preserves_main_window_on_focus_loss() {
        assert!(!should_hide_main_window_on_focus_loss(false, false, true));
    }

    #[test]
    fn ordinary_focus_loss_still_hides_main_window() {
        assert!(should_hide_main_window_on_focus_loss(false, false, false));
        assert!(!should_hide_main_window_on_focus_loss(true, false, false));
        assert!(!should_hide_main_window_on_focus_loss(false, true, false));
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
    fn preferences_window_uses_compact_fixed_bounds() {
        let preferences = auxiliary_window_descriptor("preferences")
            .expect("preferences window should have a dynamic descriptor");
        let expected_size = LogicalWindowSize {
            width: 600.0,
            height: 480.0,
        };

        assert_eq!(preferences.size, expected_size);
        assert_eq!(preferences.min_size, Some(expected_size));
        assert_eq!(preferences.max_size, Some(expected_size));
        assert!(!preferences.resizable);
    }

    #[test]
    fn default_capability_allows_custom_titlebar_dragging() {
        let capability: Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let permissions = capability["permissions"].as_array().unwrap();

        assert!(
            permissions
                .iter()
                .any(|permission| permission.as_str() == Some("core:window:allow-start-dragging")),
            "dialog frames call Window.startDragging() from non-interactive regions"
        );
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

    #[test]
    fn tray_tooltip_is_localized() {
        assert_eq!(tray_tooltip(&AppLanguage::ZhCn), "更好用的剪贴板工具 mclip");
        assert_eq!(
            tray_tooltip(&AppLanguage::En),
            "A better clipboard history tool, mclip"
        );
        assert!(!tray_tooltip(&AppLanguage::System).is_empty());
    }

    #[test]
    fn menu_bar_icon_styles_load_valid_assets() {
        let app_icon = menu_bar_icon(&MenuBarIconStyle::AppIcon).unwrap();
        let light_icon = menu_bar_icon(&MenuBarIconStyle::Light).unwrap();
        let m_icon = menu_bar_icon(&MenuBarIconStyle::M).unwrap();

        assert_eq!(app_icon.width(), 1024);
        assert_eq!(app_icon.height(), 1024);
        assert_eq!(light_icon.width(), 512);
        assert_eq!(light_icon.height(), 512);
        assert_eq!(m_icon.width(), 512);
        assert_eq!(m_icon.height(), 512);
    }

    #[test]
    fn template_menu_bar_icons_use_macos_template_rendering() {
        assert!(!menu_bar_icon_is_template(&MenuBarIconStyle::AppIcon));
        assert!(menu_bar_icon_is_template(&MenuBarIconStyle::Light));
        assert!(menu_bar_icon_is_template(&MenuBarIconStyle::M));
    }
}
