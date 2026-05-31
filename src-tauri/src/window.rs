//! 主窗口与 preview 窗口的尺寸、定位和显示隐藏规则。
//! 主窗口只承载左侧列表；分组预览拆到独立透明窗口，避免撑大主窗口。

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Size};
use tauri_plugin_positioner::{Position as TrayPosition, WindowExt};

#[cfg(target_os = "macos")]
use raw_window_handle::HasWindowHandle;

pub const WINDOW_WIDTH: f64 = 320.0;
pub const MAX_WINDOW_HEIGHT: f64 = 900.0;
pub const MAIN_WINDOW_SHOWN_EVENT: &str = "main-window-shown";
const ABOUT_WINDOW_LABEL: &str = "about";
const PREFERENCES_WINDOW_LABEL: &str = "preferences";

const HEADER_HEIGHT: f64 = 56.0;
const GROUP_ROW_HEIGHT: f64 = 52.0;
const FOOTER_HEIGHT: f64 = 144.0;
const PER_ITEM_HEIGHT: f64 = 34.0;
const EMPTY_STATE_HEIGHT: f64 = 120.0;
const MIN_PREVIEW_WINDOW_WIDTH: f64 = 240.0;
const MAX_PREVIEW_WINDOW_WIDTH: f64 = 680.0;
const MIN_PREVIEW_WINDOW_HEIGHT: f64 = 120.0;
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
    preview_height: f64,
    preview_width: f64,
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
    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: clamp_preview_width(preview_width),
            height: clamp_preview_height(preview_height),
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
pub fn set_history_preview_window_width(
    app_handle: AppHandle,
    preview_width: f64,
) -> Result<(), String> {
    let Some(preview_window) = app_handle.get_webview_window("preview") else {
        return Ok(());
    };
    let current_size = preview_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let scale_factor = preview_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let logical_size = current_size.to_logical::<f64>(scale_factor);

    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: clamp_preview_width(preview_width),
            height: logical_size.height,
        }))
        .map_err(|error| error.to_string())
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

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowPointerPosition {
    x: f64,
    y: f64,
}

#[tauri::command]
pub fn get_history_preview_pointer_position(
    app_handle: AppHandle,
) -> Result<Option<WindowPointerPosition>, String> {
    get_pointer_position_in_window(&app_handle, "preview")
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

fn get_pointer_position_in_window(
    app_handle: &AppHandle,
    label: &str,
) -> Result<Option<WindowPointerPosition>, String> {
    let Some(window) = app_handle.get_webview_window(label) else {
        return Ok(None);
    };

    if !window.is_visible().unwrap_or(false) {
        return Ok(None);
    }

    let cursor_position = window
        .cursor_position()
        .map_err(|error| error.to_string())?;
    let window_position = window.outer_position().map_err(|error| error.to_string())?;
    let window_size = window.outer_size().map_err(|error| error.to_string())?;
    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;

    Ok(physical_point_to_logical_window_position(
        cursor_position.x,
        cursor_position.y,
        f64::from(window_position.x),
        f64::from(window_position.y),
        f64::from(window_size.width),
        f64::from(window_size.height),
        scale_factor,
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

    #[cfg(target_os = "macos")]
    {
        apply_window_corner_radius(app_handle, "main", CORNER_RADIUS);
        apply_window_corner_radius(app_handle, "preview", CORNER_RADIUS);
        apply_window_corner_radius(app_handle, "about", CORNER_RADIUS);
        apply_window_corner_radius(app_handle, "preferences", CORNER_RADIUS);
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

fn clamp_preview_width(width: f64) -> f64 {
    width.clamp(MIN_PREVIEW_WINDOW_WIDTH, MAX_PREVIEW_WINDOW_WIDTH)
}

fn clamp_preview_height(height: f64) -> f64 {
    height.clamp(MIN_PREVIEW_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT)
}

fn is_physical_point_in_rect(x: f64, y: f64, left: f64, top: f64, width: f64, height: f64) -> bool {
    x >= left && x <= left + width && y >= top && y <= top + height
}

fn physical_point_to_logical_window_position(
    x: f64,
    y: f64,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
    scale_factor: f64,
) -> Option<WindowPointerPosition> {
    if scale_factor <= 0.0 || !is_physical_point_in_rect(x, y, left, top, width, height) {
        return None;
    }

    Some(WindowPointerPosition {
        x: (x - left) / scale_factor,
        y: (y - top) / scale_factor,
    })
}

#[cfg(target_os = "macos")]
const CORNER_RADIUS: f64 = 20.0;

#[cfg(target_os = "macos")]
fn apply_window_corner_radius(app_handle: &AppHandle, label: &str, radius: f64) {
    use raw_window_handle::RawWindowHandle;

    let Some(window) = app_handle.get_webview_window(label) else {
        return;
    };
    let Ok(window_handle) = window.window_handle() else {
        return;
    };
    let RawWindowHandle::AppKit(handle) = window_handle.as_raw() else {
        return;
    };

    macos_window::set_corner_radius(handle.ns_view.as_ptr(), radius);
}

#[cfg(target_os = "macos")]
mod macos_window {
    use std::ffi::{c_char, c_void};

    type ObjcId = *mut c_void;

    #[allow(clashing_extern_declarations)]
    #[link(name = "objc", kind = "dylib")]
    unsafe extern "C" {
        #[link_name = "sel_registerName"]
        fn sel(name: *const c_char) -> ObjcId;

        #[link_name = "objc_getClass"]
        fn objc_getClass(name: *const c_char) -> ObjcId;

        #[link_name = "objc_msgSend"]
        fn msg_send_id(receiver: ObjcId, selector: ObjcId) -> ObjcId;

        #[link_name = "objc_msgSend"]
        fn msg_send_bool(receiver: ObjcId, selector: ObjcId, value: i8);

        #[link_name = "objc_msgSend"]
        fn msg_send_double(receiver: ObjcId, selector: ObjcId, value: f64);

        #[link_name = "objc_msgSend"]
        fn msg_send_void_id(receiver: ObjcId, selector: ObjcId, arg: ObjcId);
    }

    fn layer_backed_view_set_corner_radius(view: ObjcId, radius: f64) {
        unsafe {
            msg_send_bool(view, sel(c"setWantsLayer:".as_ptr()), 1);
            let layer = msg_send_id(view, sel(c"layer".as_ptr()));
            if layer.is_null() {
                return;
            }
            msg_send_double(layer, sel(c"setCornerRadius:".as_ptr()), radius);
            msg_send_bool(layer, sel(c"setMasksToBounds:".as_ptr()), 1);
        }
    }

    pub fn set_corner_radius(ns_view: *mut c_void, radius: f64) {
        unsafe {
            // [nsView window] -> NSWindow
            let ns_window = msg_send_id(ns_view as ObjcId, sel(c"window".as_ptr()));

            if ns_window.is_null() {
                return;
            }

            // Ensure the window itself is non-opaque with a clear background so
            // the rounded corners are truly transparent.
            msg_send_bool(ns_window, sel(c"setOpaque:".as_ptr()), 0);

            let ns_color_class = objc_getClass(c"NSColor".as_ptr());
            let clear_color = msg_send_id(ns_color_class, sel(c"clearColor".as_ptr()));
            if !clear_color.is_null() {
                msg_send_void_id(ns_window, sel(c"setBackgroundColor:".as_ptr()), clear_color);
            }

            // Round the contentView layer — this gives the NSWindow its shape.
            let content_view = msg_send_id(ns_window, sel(c"contentView".as_ptr()));
            if !content_view.is_null() {
                layer_backed_view_set_corner_radius(content_view, radius);
            }

            // Round the WKWebView's layer as well. Without this the webview
            // renders a sharp rectangle that bleeds past the contentView clip.
            layer_backed_view_set_corner_radius(ns_view as ObjcId, radius);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        calculate_window_height, clamp_preview_height, clamp_preview_width,
        is_physical_point_in_rect, MAX_WINDOW_HEIGHT,
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
    fn preview_width_is_clamped_to_supported_range() {
        assert_eq!(clamp_preview_width(10.0), 240.0);
        assert_eq!(clamp_preview_width(608.0), 608.0);
        assert_eq!(clamp_preview_width(2000.0), 680.0);
    }

    #[test]
    fn preview_height_is_clamped_to_supported_range() {
        assert_eq!(clamp_preview_height(10.0), 120.0);
        assert_eq!(clamp_preview_height(182.0), 182.0);
        assert_eq!(clamp_preview_height(2000.0), MAX_WINDOW_HEIGHT);
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

    #[test]
    fn physical_pointer_position_is_converted_to_logical_window_position() {
        assert_eq!(
            super::physical_point_to_logical_window_position(
                320.0, 260.0, 280.0, 220.0, 120.0, 100.0, 2.0,
            ),
            Some(super::WindowPointerPosition { x: 20.0, y: 20.0 }),
        );
    }

    #[test]
    fn physical_pointer_position_is_empty_outside_window() {
        assert_eq!(
            super::physical_point_to_logical_window_position(
                401.0, 260.0, 280.0, 220.0, 120.0, 100.0, 2.0,
            ),
            None,
        );
    }
}
