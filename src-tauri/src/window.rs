use tauri::{AppHandle, Emitter, LogicalSize, Manager, Size};
use tauri_plugin_positioner::{Position, WindowExt};

pub const WINDOW_WIDTH: f64 = 320.0;
pub const WINDOW_PREVIEW_WIDTH: f64 = 660.0;
pub const MAX_WINDOW_HEIGHT: f64 = 900.0;
pub const MAIN_WINDOW_SHOWN_EVENT: &str = "main-window-shown";

const HEADER_HEIGHT: f64 = 64.0;
const GROUP_ROW_HEIGHT: f64 = 52.0;
const FOOTER_HEIGHT: f64 = 168.0;
const PER_ITEM_HEIGHT: f64 = 34.0;
const EMPTY_STATE_HEIGHT: f64 = 120.0;

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
    preview_item_count: u32,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .set_size(Size::Logical(LogicalSize {
                width: if preview_item_count > 0 {
                    WINDOW_PREVIEW_WIDTH
                } else {
                    WINDOW_WIDTH
                },
                height: calculate_window_height(item_count, group_count, preview_item_count),
            }))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn configure_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_shadow(false);
        let _ = window.set_size(Size::Logical(LogicalSize {
            width: WINDOW_WIDTH,
            height: calculate_window_height(0, 0, 0),
        }));
    }
}

pub fn hide_main_window(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn show_main_window(app_handle: &AppHandle, placement: WindowPlacement) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();

        match placement {
            WindowPlacement::Center => window.move_window(Position::Center),
            WindowPlacement::Tray => window.move_window_constrained(Position::TrayBottomCenter),
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
            window.hide().map_err(|error| error.to_string())?;
        } else {
            show_main_window(app_handle, placement)?;
        }
    }

    Ok(())
}

fn calculate_window_height(item_count: u32, group_count: u32, preview_item_count: u32) -> f64 {
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
    let _ = preview_item_count;

    (HEADER_HEIGHT + group_rows_height + FOOTER_HEIGHT + content_height).min(MAX_WINDOW_HEIGHT)
}

#[cfg(test)]
mod tests {
    use super::{calculate_window_height, MAX_WINDOW_HEIGHT};

    #[test]
    fn empty_state_height_has_expected_floor() {
        assert_eq!(calculate_window_height(0, 0, 0), 352.0);
    }

    #[test]
    fn group_nav_height_is_included_when_multiple_groups_exist() {
        assert_eq!(calculate_window_height(10, 2, 0), 624.0);
    }

    #[test]
    fn list_height_is_capped_at_maximum() {
        assert_eq!(calculate_window_height(100, 10, 0), MAX_WINDOW_HEIGHT);
    }
}
