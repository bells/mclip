//! 主窗口与 preview 窗口的尺寸、定位和显示隐藏规则。
//! 主窗口只承载左侧列表；分组预览拆到独立透明窗口，避免撑大主窗口。

use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Size};
use tauri_plugin_positioner::{Position as TrayPosition, WindowExt};

pub const WINDOW_WIDTH: f64 = 320.0;
pub const PREVIEW_WINDOW_WIDTH: f64 = 304.0;
pub const MAX_WINDOW_HEIGHT: f64 = 900.0;
pub const MAIN_WINDOW_SHOWN_EVENT: &str = "main-window-shown";
const ABOUT_WINDOW_LABEL: &str = "about";
const PREFERENCES_WINDOW_LABEL: &str = "preferences";

const HEADER_HEIGHT: f64 = 56.0;
const GROUP_ROW_HEIGHT: f64 = 52.0;
const FOOTER_HEIGHT: f64 = 144.0;
const PER_ITEM_HEIGHT: f64 = 34.0;
const EMPTY_STATE_HEIGHT: f64 = 120.0;
const PREVIEW_HEADER_HEIGHT: f64 = 58.0;
const PREVIEW_ITEM_HEIGHT: f64 = 38.0;
// Keep the preview flush with the main window so the pointer can cross into it
// without passing through a dead hover gap.
const PREVIEW_WINDOW_GAP: f64 = 0.0;

#[derive(Debug, Clone, Copy)]
pub enum WindowPlacement {
    Center,
    Tray,
}

#[tauri::command]
pub fn adjust_window_height(
    app_handle: AppHandle,
    item_count: u32,
    group_count: u32,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .set_size(Size::Logical(LogicalSize {
                width: WINDOW_WIDTH,
                height: calculate_window_height(item_count, group_count),
            }))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn show_history_preview_window(
    app_handle: AppHandle,
    anchor_top: f64,
    item_count: u32,
) -> Result<(), String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(());
    };
    let Some(preview_window) = app_handle.get_webview_window("preview") else {
        return Ok(());
    };

    let scale_factor = main_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    // React reports the hovered row's top in logical pixels. Convert the main
    // window origin before composing the preview window position.
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(scale_factor);
    let preview_height = calculate_preview_window_height(item_count);

    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: PREVIEW_WINDOW_WIDTH,
            height: preview_height,
        }))
        .map_err(|error| error.to_string())?;
    preview_window
        .set_position(Position::Logical(LogicalPosition {
            x: main_position.x + WINDOW_WIDTH + PREVIEW_WINDOW_GAP,
            y: main_position.y + anchor_top,
        }))
        .map_err(|error| error.to_string())?;
    preview_window.show().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_history_preview_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(preview_window) = app_handle.get_webview_window("preview") {
        preview_window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn show_about_window(app_handle: AppHandle) -> Result<(), String> {
    show_centered_dialog_window(&app_handle, ABOUT_WINDOW_LABEL)
}

#[tauri::command]
pub fn show_preferences_window(app_handle: AppHandle) -> Result<(), String> {
    show_centered_dialog_window(&app_handle, PREFERENCES_WINDOW_LABEL)
}

#[tauri::command]
pub fn is_pointer_over_history_preview_window(app_handle: AppHandle) -> Result<bool, String> {
    is_pointer_over_preview_window(&app_handle)
}

pub fn is_pointer_over_preview_window(app_handle: &AppHandle) -> Result<bool, String> {
    let Some(preview_window) = app_handle.get_webview_window("preview") else {
        return Ok(false);
    };

    if !preview_window.is_visible().unwrap_or(false) {
        return Ok(false);
    }

    let cursor_position = preview_window
        .cursor_position()
        .map_err(|error| error.to_string())?;
    let preview_position = preview_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let preview_size = preview_window
        .outer_size()
        .map_err(|error| error.to_string())?;

    // Cross-window mouse events can arrive late or not at all with separate
    // transparent windows. Native hit testing is the reliable source of truth
    // before deciding whether to hide the preview.
    Ok(is_physical_point_in_rect(
        cursor_position.x,
        cursor_position.y,
        f64::from(preview_position.x),
        f64::from(preview_position.y),
        f64::from(preview_size.width),
        f64::from(preview_size.height),
    ))
}

pub fn configure_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_shadow(false);
        let _ = window.set_size(Size::Logical(LogicalSize {
            width: WINDOW_WIDTH,
            height: calculate_window_height(0, 0),
        }));
    }

    if let Some(window) = app_handle.get_webview_window("preview") {
        let _ = window.set_shadow(false);
        // The preview should feel like part of the main popover. If it takes
        // focus, the main window's focus-loss handler can close both windows.
        let _ = window.set_focusable(false);
    }
}

fn show_centered_dialog_window(app_handle: &AppHandle, label: &str) -> Result<(), String> {
    let Some(window) = app_handle.get_webview_window(label) else {
        return Ok(());
    };

    let _ = window.unminimize();

    window
        .move_window(TrayPosition::Center)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub fn hide_main_window(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }
    hide_history_preview_window(app_handle.clone())?;

    Ok(())
}

pub fn show_main_window(app_handle: &AppHandle, placement: WindowPlacement) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();

        match placement {
            WindowPlacement::Center => window.move_window(TrayPosition::Center),
            WindowPlacement::Tray => window.move_window_constrained(TrayPosition::TrayBottomCenter),
        }
        .map_err(|error| error.to_string())?;

        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        app_handle
            .emit(MAIN_WINDOW_SHOWN_EVENT, ())
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn toggle_main_window(
    app_handle: &AppHandle,
    placement: WindowPlacement,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            hide_main_window(app_handle)?;
        } else {
            show_main_window(app_handle, placement)?;
        }
    }

    Ok(())
}

fn calculate_window_height(item_count: u32, group_count: u32) -> f64 {
    let content_height = if item_count == 0 {
        EMPTY_STATE_HEIGHT
    } else {
        item_count as f64 * PER_ITEM_HEIGHT
    };
    let group_rows_height = if group_count > 1 {
        (group_count - 1) as f64 * GROUP_ROW_HEIGHT
    } else {
        0.0
    };

    (HEADER_HEIGHT + group_rows_height + FOOTER_HEIGHT + content_height).min(MAX_WINDOW_HEIGHT)
}

fn calculate_preview_window_height(item_count: u32) -> f64 {
    PREVIEW_HEADER_HEIGHT + item_count as f64 * PREVIEW_ITEM_HEIGHT
}

fn is_physical_point_in_rect(x: f64, y: f64, left: f64, top: f64, width: f64, height: f64) -> bool {
    x >= left && x <= left + width && y >= top && y <= top + height
}

#[cfg(test)]
mod tests {
    use super::{
        calculate_preview_window_height, calculate_window_height, is_physical_point_in_rect,
        MAX_WINDOW_HEIGHT,
    };

    #[test]
    fn empty_state_height_has_expected_floor() {
        assert_eq!(calculate_window_height(0, 0), 320.0);
    }

    #[test]
    fn group_nav_height_is_included_when_multiple_groups_exist() {
        assert_eq!(calculate_window_height(10, 2), 592.0);
    }

    #[test]
    fn list_height_is_capped_at_maximum() {
        assert_eq!(calculate_window_height(100, 10), MAX_WINDOW_HEIGHT);
    }

    #[test]
    fn preview_height_tracks_item_count() {
        assert_eq!(calculate_preview_window_height(4), 210.0);
    }

    #[test]
    fn point_rect_hit_test_includes_edges() {
        assert!(is_physical_point_in_rect(
            10.0, 20.0, 10.0, 20.0, 100.0, 80.0
        ));
        assert!(is_physical_point_in_rect(
            110.0, 100.0, 10.0, 20.0, 100.0, 80.0
        ));
        assert!(!is_physical_point_in_rect(
            111.0, 100.0, 10.0, 20.0, 100.0, 80.0
        ));
    }
}
