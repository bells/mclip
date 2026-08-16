//! 主窗口与 preview 窗口的尺寸、定位和显示隐藏规则。
//! 主窗口只承载左侧列表；分组预览拆到独立透明窗口，避免撑大主窗口。

use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use std::{thread, time::Duration};

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, PhysicalPosition,
    PhysicalSize, Position, Rect, Runtime, Size, WebviewWindow,
};
use tauri_plugin_positioner::{Position as TrayPosition, WindowExt};

use crate::auxiliary_windows::ensure_auxiliary_window_ready;
use crate::performance::{
    next_interaction_id, record_rust_milestone, PerformanceInteraction, PerformanceMilestoneName,
    PerformanceOutcome, PerformanceRecorder, PerformanceWindowLabel,
};

#[cfg(target_os = "macos")]
use raw_window_handle::HasWindowHandle;

pub const WINDOW_WIDTH: f64 = 320.0;
pub const MAX_WINDOW_HEIGHT: f64 = 900.0;
const MIN_MAIN_WINDOW_HEIGHT: f64 = 220.0;
pub const MAIN_WINDOW_SHOWN_EVENT: &str = "main-window-shown";
const HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT: &str = "history-preview-placement-updated";
const PREVIEW_WINDOW_LABEL: &str = "preview";
const PREVIEW_DETAIL_WINDOW_LABEL: &str = "preview-detail";
pub const IMAGE_VIEWER_WINDOW_LABEL: &str = "image-viewer";
const IMAGE_VIEWER_DEFAULT_WIDTH: f64 = 720.0;
const IMAGE_VIEWER_DEFAULT_HEIGHT: f64 = 520.0;
static IMAGE_VIEWER_CLOSE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
const ABOUT_WINDOW_LABEL: &str = "about";
const PREFERENCES_WINDOW_LABEL: &str = "preferences";

const HEADER_HEIGHT: f64 = 52.0;
const BODY_VERTICAL_PADDING: f64 = 8.0;
const ARCHIVE_TOP_OVERLAP: f64 = 4.0;
const ARCHIVE_ROW_HEIGHT: f64 = 28.0;
const ARCHIVE_ROW_GAP: f64 = 0.0;
const FOOTER_HEIGHT: f64 = 129.0;
const PER_ITEM_HEIGHT: f64 = 32.0;
const EMPTY_STATE_HEIGHT: f64 = 120.0;
const MIN_PREVIEW_WINDOW_WIDTH: f64 = 240.0;
const MAX_PREVIEW_WINDOW_WIDTH: f64 = 680.0;
const MIN_PREVIEW_WINDOW_HEIGHT: f64 = 80.0;
// Keep the preview flush with the main window so the pointer can cross into it
// without passing through a dead hover gap.
const PREVIEW_WINDOW_GAP: f64 = 0.0;
const FALLBACK_SCREEN_BOUNDS_SIZE: f64 = 200_000.0;

#[derive(Debug, Clone, Copy)]
pub enum WindowPlacement {
    Center,
    Tray(TrayWindowAnchor),
}

#[derive(Debug, Clone, Copy)]
pub struct TrayWindowAnchor {
    x: f64,
    y: f64,
    monitor_probe_y: f64,
}

impl TrayWindowAnchor {
    pub fn from_event(position: PhysicalPosition<f64>, rect: Rect) -> Self {
        Self::from_rect(rect).unwrap_or(Self {
            x: position.x,
            y: position.y,
            monitor_probe_y: position.y,
        })
    }

    pub fn from_rect(rect: Rect) -> Option<Self> {
        let rect_position = rect.position.to_physical::<f64>(1.0);
        let rect_size = rect.size.to_physical::<f64>(1.0);

        if rect_size.width <= 0.0 || rect_size.height <= 0.0 {
            return None;
        }

        Some(Self {
            x: rect_position.x + rect_size.width / 2.0,
            y: rect_position.y,
            monitor_probe_y: rect_position.y + rect_size.height / 2.0,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewWindowSide {
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowPosition {
    x: f64,
    y: f64,
    side: PreviewWindowSide,
}

#[derive(Debug, Clone, Copy)]
struct ScreenBounds {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Copy)]
struct PreviewWindowPositionInput {
    main_x: f64,
    main_y: f64,
    anchor_top: f64,
    main_width: f64,
    preview_width: f64,
    preview_height: f64,
    required_preview_width: f64,
    screen_bounds: ScreenBounds,
}

#[derive(Debug, Clone, Copy)]
struct PreviewWindowResizeInput {
    current_x: f64,
    current_y: f64,
    main_x: f64,
    preview_height: f64,
    screen_bounds: ScreenBounds,
}

#[derive(Debug, Clone, Copy)]
struct PreviewFamilyPositionInput {
    group_x: f64,
    group_y: f64,
    detail_y: f64,
    group_width: f64,
    detail_width: f64,
    detail_height: f64,
    preferred_side: PreviewWindowSide,
    screen_bounds: ScreenBounds,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFamilyPosition {
    group: PreviewWindowPosition,
    detail: PreviewWindowPosition,
}

#[derive(Debug, Clone, Copy)]
struct TrayWindowPositionInput {
    anchor_x: f64,
    anchor_y: f64,
    window_width: f64,
    window_height: f64,
    screen_bounds: ScreenBounds,
}

#[tauri::command]
pub fn adjust_window_height(
    app_handle: AppHandle,
    item_count: u32,
    group_count: u32,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let desired_height = calculate_window_height(item_count, group_count);
        let window_height = window
            .current_monitor()
            .map_err(|error| error.to_string())?
            .as_ref()
            .map(monitor_work_area_bounds)
            .map(|screen_bounds| {
                calculate_window_height_for_screen_bounds(item_count, group_count, screen_bounds)
            })
            .unwrap_or(desired_height);

        window
            .set_size(Size::Logical(LogicalSize {
                width: WINDOW_WIDTH,
                height: window_height,
            }))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn adjust_window_height_to_content(
    app_handle: AppHandle,
    content_height: f64,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let desired_height = calculate_content_window_height(content_height);
        let window_height = window
            .current_monitor()
            .map_err(|error| error.to_string())?
            .as_ref()
            .map(monitor_work_area_bounds)
            .map(|screen_bounds| {
                calculate_content_window_height_for_screen_bounds(content_height, screen_bounds)
            })
            .unwrap_or(desired_height);

        window
            .set_size(Size::Logical(LogicalSize {
                width: WINDOW_WIDTH,
                height: window_height,
            }))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn show_history_preview_window(
    app_handle: AppHandle,
    anchor_top: f64,
    preview_height: f64,
    preview_width: f64,
    required_preview_width: f64,
    interaction_id: Option<String>,
) -> Result<PreviewWindowPosition, String> {
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::PreviewRequest,
        Some(PerformanceWindowLabel::Preview),
        interaction_id.clone(),
        PerformanceOutcome::Success,
    );
    ensure_auxiliary_window_ready(&app_handle, PREVIEW_WINDOW_LABEL).await?;
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_window_position());
    };

    if !main_window
        .is_visible()
        .map_err(|error| error.to_string())?
    {
        hide_history_preview_window(app_handle)?;
        return Ok(default_preview_window_position());
    }

    let scale_factor = main_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    // React reports the hovered row's top in logical pixels. Convert the main
    // window origin before composing the preview window position.
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(scale_factor);
    let screen_bounds = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| monitor_work_area_bounds(&monitor))
        .unwrap_or_else(|| fallback_screen_bounds(main_position.x, main_position.y));
    let clamped_preview_width = clamp_preview_width(preview_width);
    let clamped_preview_height =
        clamp_preview_height_for_screen_bounds(preview_height, screen_bounds);
    let clamped_required_width =
        clamp_preview_width(required_preview_width.max(clamped_preview_width));
    let position = calculate_preview_window_position(PreviewWindowPositionInput {
        main_x: main_position.x,
        main_y: main_position.y,
        anchor_top,
        main_width: WINDOW_WIDTH,
        preview_width: clamped_preview_width,
        preview_height: clamped_preview_height,
        required_preview_width: clamped_required_width,
        screen_bounds,
    });

    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: clamped_preview_width,
            height: clamped_preview_height,
        }))
        .map_err(|error| error.to_string())?;
    preview_window
        .set_position(Position::Logical(LogicalPosition {
            x: position.x,
            y: position.y,
        }))
        .map_err(|error| error.to_string())?;
    preview_window
        .emit(HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT, position)
        .map_err(|error| error.to_string())?;

    if !main_window
        .is_visible()
        .map_err(|error| error.to_string())?
    {
        hide_history_preview_window(app_handle)?;
        return Ok(default_preview_window_position());
    }

    preview_window.show().map_err(|error| error.to_string())?;
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::PreviewNativeVisible,
        Some(PerformanceWindowLabel::Preview),
        interaction_id,
        PerformanceOutcome::Success,
    );

    Ok(position)
}

#[tauri::command]
pub fn resize_history_preview_window(
    app_handle: AppHandle,
    preview_height: f64,
) -> Result<PreviewWindowPosition, String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_window_position());
    };

    if !main_window
        .is_visible()
        .map_err(|error| error.to_string())?
        || !preview_window
            .is_visible()
            .map_err(|error| error.to_string())?
    {
        return Ok(default_preview_window_position());
    }

    let scale_factor = preview_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let preview_position = preview_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let preview_size = preview_window
        .outer_size()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(scale_factor);
    let current_monitor = preview_window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let logical_screen_bounds = current_monitor
        .as_ref()
        .map(monitor_work_area_bounds)
        .unwrap_or_else(|| {
            fallback_screen_bounds(
                f64::from(preview_position.x) / scale_factor,
                f64::from(preview_position.y) / scale_factor,
            )
        });
    let physical_screen_bounds = current_monitor
        .as_ref()
        .map(monitor_physical_work_area_bounds)
        .unwrap_or_else(|| {
            fallback_screen_bounds(f64::from(preview_position.x), f64::from(preview_position.y))
        });
    let clamped_preview_height =
        clamp_preview_height_for_screen_bounds(preview_height, logical_screen_bounds);
    // Height measurements arrive after the group and detail have already been
    // positioned as a family. Keep the group's X coordinate untouched so a
    // late resize cannot move it back over the independent detail window.
    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: preview_size.width,
            height: clamped_preview_height,
        }))
        .map_err(|error| error.to_string())?;
    let resized_preview_position = preview_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let resized_preview_size = preview_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let position = calculate_preview_window_resize_position(PreviewWindowResizeInput {
        current_x: f64::from(resized_preview_position.x),
        current_y: f64::from(resized_preview_position.y),
        main_x: f64::from(main_position.x),
        preview_height: f64::from(resized_preview_size.height),
        screen_bounds: physical_screen_bounds,
    });
    preview_window
        .set_position(Position::Physical(PhysicalPosition::new(
            position.x.round() as i32,
            position.y.round() as i32,
        )))
        .map_err(|error| error.to_string())?;

    Ok(position)
}

#[tauri::command]
pub fn hide_history_preview_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) {
        preview_window.hide().map_err(|error| error.to_string())?;
    }

    hide_history_preview_detail_window(app_handle)
}

#[tauri::command]
pub fn hide_history_preview_detail_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(preview_detail_window) = app_handle.get_webview_window(PREVIEW_DETAIL_WINDOW_LABEL)
    {
        preview_detail_window
            .hide()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn show_history_preview_detail_window(
    app_handle: AppHandle,
    detail_anchor_top: f64,
    detail_height: f64,
    detail_width: f64,
    interaction_id: Option<String>,
) -> Result<PreviewFamilyPosition, String> {
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::PreviewRequest,
        Some(PerformanceWindowLabel::PreviewDetail),
        interaction_id.clone(),
        PerformanceOutcome::Success,
    );
    ensure_auxiliary_window_ready(&app_handle, PREVIEW_DETAIL_WINDOW_LABEL).await?;
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_family_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_family_position());
    };
    let Some(preview_detail_window) = app_handle.get_webview_window(PREVIEW_DETAIL_WINDOW_LABEL)
    else {
        return Ok(default_preview_family_position());
    };

    if !main_window
        .is_visible()
        .map_err(|error| error.to_string())?
        || !preview_window
            .is_visible()
            .map_err(|error| error.to_string())?
    {
        hide_history_preview_detail_window(app_handle)?;
        return Ok(default_preview_family_position());
    }

    // The detail is moving onto the preview's monitor. Use that monitor's
    // scale for both its physical size and position instead of the hidden
    // detail window's possibly stale scale/frame.
    let preview_scale_factor = preview_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let preview_position = preview_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let preview_size = preview_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let clamped_detail_width = clamp_preview_width(detail_width);
    let current_monitor = preview_window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let logical_screen_bounds = current_monitor
        .as_ref()
        .map(monitor_work_area_bounds)
        .unwrap_or_else(|| {
            fallback_screen_bounds(
                f64::from(preview_position.x) / preview_scale_factor,
                f64::from(preview_position.y) / preview_scale_factor,
            )
        });
    let clamped_detail_height =
        clamp_preview_height_for_screen_bounds(detail_height, logical_screen_bounds);
    let physical_detail_width = clamped_detail_width * preview_scale_factor;
    let physical_detail_height = clamped_detail_height * preview_scale_factor;
    if !detail_anchor_top.is_finite() {
        return Err("history preview detail anchor must be finite".to_string());
    }
    let physical_detail_y =
        f64::from(preview_position.y) + detail_anchor_top * preview_scale_factor;
    let preferred_side = if preview_position.x < main_position.x {
        PreviewWindowSide::Left
    } else {
        PreviewWindowSide::Right
    };
    let screen_bounds = current_monitor
        .as_ref()
        .map(monitor_physical_work_area_bounds)
        .unwrap_or_else(|| {
            fallback_screen_bounds(f64::from(preview_position.x), f64::from(preview_position.y))
        });
    let position = calculate_preview_family_position(PreviewFamilyPositionInput {
        group_x: f64::from(preview_position.x),
        group_y: f64::from(preview_position.y),
        detail_y: physical_detail_y,
        group_width: f64::from(preview_size.width),
        detail_width: physical_detail_width,
        detail_height: physical_detail_height,
        preferred_side,
        screen_bounds,
    });

    preview_detail_window
        .set_size(Size::Physical(PhysicalSize {
            width: physical_detail_width.round().max(1.0) as u32,
            height: physical_detail_height.round().max(1.0) as u32,
        }))
        .map_err(|error| error.to_string())?;
    preview_detail_window
        .set_position(Position::Physical(PhysicalPosition::new(
            position.detail.x.round() as i32,
            position.detail.y.round() as i32,
        )))
        .map_err(|error| error.to_string())?;
    preview_detail_window
        .emit(HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT, position.detail)
        .map_err(|error| error.to_string())?;

    if !main_window
        .is_visible()
        .map_err(|error| error.to_string())?
        || !preview_window
            .is_visible()
            .map_err(|error| error.to_string())?
    {
        hide_history_preview_detail_window(app_handle)?;
        return Ok(default_preview_family_position());
    }

    preview_detail_window
        .show()
        .map_err(|error| error.to_string())?;
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::PreviewNativeVisible,
        Some(PerformanceWindowLabel::PreviewDetail),
        interaction_id,
        PerformanceOutcome::Success,
    );

    Ok(position)
}

#[tauri::command]
pub async fn show_about_window(app_handle: AppHandle) -> Result<(), String> {
    ensure_auxiliary_window_ready(&app_handle, ABOUT_WINDOW_LABEL).await?;
    show_centered_dialog_window(&app_handle, ABOUT_WINDOW_LABEL)
}

#[tauri::command]
pub async fn show_preferences_window(app_handle: AppHandle) -> Result<(), String> {
    ensure_auxiliary_window_ready(&app_handle, PREFERENCES_WINDOW_LABEL).await?;
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
    get_pointer_position_in_window(&app_handle, PREVIEW_WINDOW_LABEL)
}

pub fn is_pointer_over_preview_window(app_handle: &AppHandle) -> Result<bool, String> {
    Ok(is_pointer_over_window(app_handle, PREVIEW_WINDOW_LABEL)?
        || is_pointer_over_window(app_handle, PREVIEW_DETAIL_WINDOW_LABEL)?)
}

fn is_pointer_over_window(app_handle: &AppHandle, label: &str) -> Result<bool, String> {
    let Some(preview_window) = app_handle.get_webview_window(label) else {
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

    for label in [PREVIEW_WINDOW_LABEL, PREVIEW_DETAIL_WINDOW_LABEL] {
        if let Some(window) = app_handle.get_webview_window(label) {
            let _ = window.set_shadow(false);
            // The preview should feel like part of the main popover. If it
            // takes focus, the main window's focus-loss handler can close both
            // windows.
            let _ = window.set_focusable(false);
        }
    }

    #[cfg(target_os = "macos")]
    {
        apply_window_corner_radius(app_handle, "main", CORNER_RADIUS);
        apply_window_corner_radius(app_handle, PREVIEW_WINDOW_LABEL, CORNER_RADIUS);
        apply_window_corner_radius(app_handle, PREVIEW_DETAIL_WINDOW_LABEL, CORNER_RADIUS);
        apply_window_corner_radius(app_handle, "about", CORNER_RADIUS);
        apply_window_corner_radius(app_handle, "preferences", CORNER_RADIUS);
    }
}

pub fn apply_auxiliary_window_corner_radius(app_handle: &AppHandle, label: &str) {
    #[cfg(target_os = "macos")]
    apply_window_corner_radius(app_handle, label, CORNER_RADIUS);

    #[cfg(not(target_os = "macos"))]
    let _ = (app_handle, label);
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

fn show_main_window_in_place(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        app_handle
            .emit(MAIN_WINDOW_SHOWN_EVENT, ())
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn set_main_window_always_on_top(
    app_handle: &AppHandle,
    always_on_top: bool,
) -> Result<(), String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(());
    };

    main_window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())
}

fn set_image_viewer_windowed_frame<R: Runtime>(
    window: &WebviewWindow<R>,
    monitor: &Monitor,
) -> Result<(), String> {
    let scale_factor = monitor.scale_factor();
    let work_area = monitor.work_area();
    let width = (IMAGE_VIEWER_DEFAULT_WIDTH * scale_factor)
        .round()
        .min(f64::from(work_area.size.width))
        .max(1.0) as u32;
    let height = (IMAGE_VIEWER_DEFAULT_HEIGHT * scale_factor)
        .round()
        .min(f64::from(work_area.size.height))
        .max(1.0) as u32;
    let x = work_area.position.x
        + ((f64::from(work_area.size.width) - f64::from(width)) / 2.0).round() as i32;
    let y = work_area.position.y
        + ((f64::from(work_area.size.height) - f64::from(height)) / 2.0).round() as i32;

    window
        .set_size(Size::Physical(PhysicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;
    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())
}

fn focus_image_viewer<R: Runtime>(viewer: &WebviewWindow<R>) -> Result<(), String> {
    viewer.set_focus().map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    viewer
        .as_ref()
        .set_focus()
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn restore_image_viewer_if_maximized<R: Runtime>(viewer: &WebviewWindow<R>) -> Result<(), String> {
    if viewer.is_maximized().map_err(|error| error.to_string())? {
        viewer.unmaximize().map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn is_image_viewer_visible(app_handle: &AppHandle) -> Result<bool, String> {
    let Some(viewer) = app_handle.get_webview_window(IMAGE_VIEWER_WINDOW_LABEL) else {
        return Ok(false);
    };

    viewer.is_visible().map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn reinforce_image_viewer_focus<R: Runtime>(viewer: WebviewWindow<R>) {
    thread::spawn(move || {
        for delay_ms in [50, 100, 200] {
            thread::sleep(Duration::from_millis(delay_ms));

            if !viewer.is_visible().unwrap_or(false) {
                return;
            }

            let _ = focus_image_viewer(&viewer);
        }
    });
}

#[tauri::command]
pub async fn show_image_viewer(
    app_handle: AppHandle,
    interaction_id: Option<String>,
) -> Result<(), String> {
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::ViewerRequest,
        Some(PerformanceWindowLabel::ImageViewer),
        interaction_id.clone(),
        PerformanceOutcome::Success,
    );
    ensure_auxiliary_window_ready(&app_handle, IMAGE_VIEWER_WINDOW_LABEL).await?;
    let viewer = app_handle
        .get_webview_window(IMAGE_VIEWER_WINDOW_LABEL)
        .ok_or_else(|| "missing image-viewer window".to_string())?;

    let main_monitor = match app_handle.get_webview_window("main") {
        Some(main_window) => main_window
            .current_monitor()
            .map_err(|error| error.to_string())?,
        None => None,
    };
    let target_monitor = match main_monitor {
        Some(monitor) => Some(monitor),
        None => match viewer
            .current_monitor()
            .map_err(|error| error.to_string())?
        {
            Some(monitor) => Some(monitor),
            None => viewer
                .primary_monitor()
                .map_err(|error| error.to_string())?,
        },
    }
    .ok_or_else(|| "missing monitor for image-viewer".to_string())?;

    hide_history_preview_window(app_handle.clone())?;
    let was_maximized = viewer.is_maximized().map_err(|error| error.to_string())?;

    let show_result = (|| -> Result<(), String> {
        set_main_window_always_on_top(&app_handle, false)?;
        if !was_maximized {
            set_image_viewer_windowed_frame(&viewer, &target_monitor)?;
        }
        viewer.show().map_err(|error| error.to_string())?;
        if !was_maximized {
            viewer.maximize().map_err(|error| error.to_string())?;
        }
        focus_image_viewer(&viewer)
    })();

    if let Err(error) = show_result {
        record_rust_milestone(
            &app_handle.state::<PerformanceRecorder>(),
            PerformanceMilestoneName::ViewerNativeVisible,
            Some(PerformanceWindowLabel::ImageViewer),
            interaction_id,
            PerformanceOutcome::Failure,
        );
        let _ = viewer.unmaximize();
        let _ = viewer.hide();
        let _ = set_main_window_always_on_top(&app_handle, true);
        let _ = show_main_window_in_place(&app_handle);
        return Err(error);
    }

    #[cfg(target_os = "macos")]
    reinforce_image_viewer_focus(viewer);

    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::ViewerNativeVisible,
        Some(PerformanceWindowLabel::ImageViewer),
        interaction_id,
        PerformanceOutcome::Success,
    );

    Ok(())
}

#[tauri::command]
pub fn toggle_image_viewer_maximize(app_handle: AppHandle) -> Result<bool, String> {
    let viewer = app_handle
        .get_webview_window(IMAGE_VIEWER_WINDOW_LABEL)
        .ok_or_else(|| "missing image-viewer window".to_string())?;
    let is_maximized = viewer.is_maximized().map_err(|error| error.to_string())?;

    if is_maximized {
        restore_image_viewer_if_maximized(&viewer)?;
    } else {
        viewer.maximize().map_err(|error| error.to_string())?;
    }

    Ok(!is_maximized)
}

#[tauri::command]
pub fn close_image_viewer(app_handle: AppHandle) -> Result<(), String> {
    if IMAGE_VIEWER_CLOSE_IN_PROGRESS.swap(true, Ordering::AcqRel) {
        return Ok(());
    }

    let close_result = (|| -> Result<(), String> {
        let viewer = app_handle
            .get_webview_window(IMAGE_VIEWER_WINDOW_LABEL)
            .ok_or_else(|| "missing image-viewer window".to_string())?;

        if !viewer.is_visible().map_err(|error| error.to_string())? {
            set_main_window_always_on_top(&app_handle, true)?;
            return Ok(());
        }

        viewer.hide().map_err(|error| error.to_string())?;
        set_main_window_always_on_top(&app_handle, true)?;
        show_main_window_in_place(&app_handle)
    })();

    IMAGE_VIEWER_CLOSE_IN_PROGRESS.store(false, Ordering::Release);
    close_result
}

pub fn show_main_window(app_handle: &AppHandle, placement: WindowPlacement) -> Result<(), String> {
    let interaction_id = next_interaction_id("main");
    record_rust_milestone(
        &app_handle.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::MainShowRequest,
        Some(PerformanceWindowLabel::Main),
        Some(interaction_id.clone()),
        PerformanceOutcome::Success,
    );
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();

        match placement {
            WindowPlacement::Center => window
                .move_window(TrayPosition::Center)
                .map_err(|error| error.to_string())?,
            WindowPlacement::Tray(anchor) => move_window_to_tray_anchor(&window, anchor)?,
        };

        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        record_rust_milestone(
            &app_handle.state::<PerformanceRecorder>(),
            PerformanceMilestoneName::MainNativeVisible,
            Some(PerformanceWindowLabel::Main),
            Some(interaction_id.clone()),
            PerformanceOutcome::Success,
        );
        app_handle
            .emit(
                MAIN_WINDOW_SHOWN_EVENT,
                PerformanceInteraction { interaction_id },
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn move_window_to_tray_anchor<R: Runtime>(
    window: &WebviewWindow<R>,
    anchor: TrayWindowAnchor,
) -> Result<(), String> {
    let window_size = window.outer_size().map_err(|error| error.to_string())?;
    let monitor_bounds = window
        .available_monitors()
        .map_err(|error| error.to_string())?
        .iter()
        .map(monitor_physical_work_area_bounds)
        .collect::<Vec<_>>();
    let fallback_bounds = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(monitor_physical_work_area_bounds)
        .unwrap_or_else(|| fallback_screen_bounds(anchor.x, anchor.y));
    let screen_bounds =
        choose_screen_bounds_for_tray_anchor(anchor, &monitor_bounds, fallback_bounds);
    let position = calculate_tray_bottom_center_window_position(TrayWindowPositionInput {
        anchor_x: anchor.x,
        anchor_y: anchor.y,
        window_width: f64::from(window_size.width),
        window_height: f64::from(window_size.height),
        screen_bounds,
    });

    window
        .set_position(Position::Physical(position))
        .map_err(|error| error.to_string())
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
    calculate_desired_window_height(item_count, group_count).min(MAX_WINDOW_HEIGHT)
}

fn calculate_desired_window_height(item_count: u32, group_count: u32) -> f64 {
    let content_height = if item_count == 0 {
        EMPTY_STATE_HEIGHT
    } else {
        item_count as f64 * PER_ITEM_HEIGHT
    };
    let visible_archive_group_count = group_count.saturating_sub(1);
    let group_rows_height = calculate_archive_group_height(visible_archive_group_count);

    HEADER_HEIGHT + BODY_VERTICAL_PADDING + group_rows_height + FOOTER_HEIGHT + content_height
}

fn calculate_window_height_for_screen_bounds(
    item_count: u32,
    group_count: u32,
    screen_bounds: ScreenBounds,
) -> f64 {
    if screen_bounds.height <= 0.0 {
        return calculate_window_height(item_count, group_count);
    }

    calculate_desired_window_height(item_count, group_count).min(screen_bounds.height)
}

fn calculate_content_window_height(content_height: f64) -> f64 {
    calculate_desired_content_window_height(content_height).min(MAX_WINDOW_HEIGHT)
}

fn calculate_desired_content_window_height(content_height: f64) -> f64 {
    if !content_height.is_finite() || content_height <= 0.0 {
        return MIN_MAIN_WINDOW_HEIGHT;
    }

    content_height.ceil().max(MIN_MAIN_WINDOW_HEIGHT)
}

fn calculate_content_window_height_for_screen_bounds(
    content_height: f64,
    screen_bounds: ScreenBounds,
) -> f64 {
    if screen_bounds.height <= 0.0 {
        return calculate_content_window_height(content_height);
    }

    calculate_desired_content_window_height(content_height).min(screen_bounds.height)
}

fn calculate_archive_group_height(visible_group_count: u32) -> f64 {
    if visible_group_count == 0 {
        return 0.0;
    }

    visible_group_count as f64 * ARCHIVE_ROW_HEIGHT - ARCHIVE_TOP_OVERLAP
        + visible_group_count.saturating_sub(1) as f64 * ARCHIVE_ROW_GAP
}

fn clamp_preview_width(width: f64) -> f64 {
    width.clamp(MIN_PREVIEW_WINDOW_WIDTH, MAX_PREVIEW_WINDOW_WIDTH)
}

fn clamp_preview_height(height: f64) -> f64 {
    height.clamp(MIN_PREVIEW_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT)
}

fn clamp_preview_height_for_screen_bounds(height: f64, screen_bounds: ScreenBounds) -> f64 {
    let height = clamp_preview_height(height);

    if screen_bounds.height <= 0.0 {
        return height;
    }

    height.min(screen_bounds.height)
}

fn default_preview_window_position() -> PreviewWindowPosition {
    PreviewWindowPosition {
        x: 0.0,
        y: 0.0,
        side: PreviewWindowSide::Right,
    }
}

fn default_preview_family_position() -> PreviewFamilyPosition {
    let position = default_preview_window_position();

    PreviewFamilyPosition {
        group: position,
        detail: position,
    }
}

fn monitor_work_area_bounds(monitor: &Monitor) -> ScreenBounds {
    let scale_factor = monitor.scale_factor();
    let work_area = monitor.work_area();
    let position = work_area.position.to_logical::<f64>(scale_factor);
    let size = work_area.size.to_logical::<f64>(scale_factor);

    ScreenBounds {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
    }
}

fn monitor_physical_work_area_bounds(monitor: &Monitor) -> ScreenBounds {
    let work_area = monitor.work_area();

    ScreenBounds {
        left: f64::from(work_area.position.x),
        top: f64::from(work_area.position.y),
        width: f64::from(work_area.size.width),
        height: f64::from(work_area.size.height),
    }
}

fn fallback_screen_bounds(main_x: f64, main_y: f64) -> ScreenBounds {
    let half_size = FALLBACK_SCREEN_BOUNDS_SIZE / 2.0;

    ScreenBounds {
        left: main_x - half_size,
        top: main_y - half_size,
        width: FALLBACK_SCREEN_BOUNDS_SIZE,
        height: FALLBACK_SCREEN_BOUNDS_SIZE,
    }
}

fn calculate_tray_bottom_center_window_position(
    input: TrayWindowPositionInput,
) -> PhysicalPosition<i32> {
    let x = input.anchor_x - input.window_width / 2.0;
    let y = input.anchor_y;

    PhysicalPosition::new(
        clamp_window_axis(
            x,
            input.window_width,
            input.screen_bounds.left,
            input.screen_bounds.right(),
        )
        .round() as i32,
        clamp_window_axis(
            y,
            input.window_height,
            input.screen_bounds.top,
            input.screen_bounds.bottom(),
        )
        .round() as i32,
    )
}

fn choose_screen_bounds_for_tray_anchor(
    anchor: TrayWindowAnchor,
    screen_bounds: &[ScreenBounds],
    fallback_bounds: ScreenBounds,
) -> ScreenBounds {
    screen_bounds
        .iter()
        .copied()
        .find(|bounds| bounds.contains_point(anchor.x, anchor.monitor_probe_y))
        .unwrap_or(fallback_bounds)
}

fn calculate_preview_window_position(input: PreviewWindowPositionInput) -> PreviewWindowPosition {
    let right_x = input.main_x + input.main_width + PREVIEW_WINDOW_GAP;
    let required_width = input.required_preview_width.max(input.preview_width);
    let right_fits = right_x + required_width <= input.screen_bounds.right();
    let left_fits = input.main_x - required_width - PREVIEW_WINDOW_GAP >= input.screen_bounds.left;
    let side = if right_fits {
        PreviewWindowSide::Right
    } else if left_fits {
        PreviewWindowSide::Left
    } else if available_space_on_right(input.main_x, input.main_width, input.screen_bounds)
        >= available_space_on_left(input.main_x, input.screen_bounds)
    {
        PreviewWindowSide::Right
    } else {
        PreviewWindowSide::Left
    };

    calculate_preview_window_position_for_side(
        side,
        input.main_x,
        input.main_y + input.anchor_top,
        input.main_width,
        input.preview_width,
        input.preview_height,
        input.screen_bounds,
    )
}

fn calculate_preview_window_position_for_side(
    side: PreviewWindowSide,
    main_x: f64,
    target_y: f64,
    main_width: f64,
    preview_width: f64,
    preview_height: f64,
    screen_bounds: ScreenBounds,
) -> PreviewWindowPosition {
    let x = match side {
        PreviewWindowSide::Left => main_x - preview_width - PREVIEW_WINDOW_GAP,
        PreviewWindowSide::Right => main_x + main_width + PREVIEW_WINDOW_GAP,
    };

    PreviewWindowPosition {
        x: clamp_window_axis(x, preview_width, screen_bounds.left, screen_bounds.right()),
        y: clamp_window_axis(
            target_y,
            preview_height,
            screen_bounds.top,
            screen_bounds.bottom(),
        ),
        side,
    }
}

fn calculate_preview_window_resize_position(
    input: PreviewWindowResizeInput,
) -> PreviewWindowPosition {
    PreviewWindowPosition {
        x: input.current_x,
        y: clamp_window_axis(
            input.current_y,
            input.preview_height,
            input.screen_bounds.top,
            input.screen_bounds.bottom(),
        ),
        side: if input.current_x < input.main_x {
            PreviewWindowSide::Left
        } else {
            PreviewWindowSide::Right
        },
    }
}

fn calculate_preview_family_position(input: PreviewFamilyPositionInput) -> PreviewFamilyPosition {
    let detail_side = choose_preview_detail_side(input);
    let detail_x = calculate_preview_detail_x(input, detail_side);

    PreviewFamilyPosition {
        group: PreviewWindowPosition {
            x: input.group_x,
            y: input.group_y,
            side: input.preferred_side,
        },
        detail: PreviewWindowPosition {
            x: detail_x,
            y: clamp_window_axis(
                input.detail_y,
                input.detail_height,
                input.screen_bounds.top,
                input.screen_bounds.bottom(),
            ),
            side: detail_side,
        },
    }
}

fn choose_preview_detail_side(input: PreviewFamilyPositionInput) -> PreviewWindowSide {
    if preview_detail_fits_on_side(input, input.preferred_side) {
        return input.preferred_side;
    }

    let opposite_side = match input.preferred_side {
        PreviewWindowSide::Left => PreviewWindowSide::Right,
        PreviewWindowSide::Right => PreviewWindowSide::Left,
    };

    if preview_detail_fits_on_side(input, opposite_side) {
        return opposite_side;
    }

    if available_preview_detail_space(input, input.preferred_side)
        >= available_preview_detail_space(input, opposite_side)
    {
        input.preferred_side
    } else {
        opposite_side
    }
}

fn preview_detail_fits_on_side(input: PreviewFamilyPositionInput, side: PreviewWindowSide) -> bool {
    let detail_x = calculate_preview_detail_x(input, side);

    detail_x >= input.screen_bounds.left
        && detail_x + input.detail_width <= input.screen_bounds.right()
}

fn calculate_preview_detail_x(input: PreviewFamilyPositionInput, side: PreviewWindowSide) -> f64 {
    match side {
        PreviewWindowSide::Left => input.group_x - input.detail_width,
        PreviewWindowSide::Right => input.group_x + input.group_width,
    }
}

fn available_preview_detail_space(
    input: PreviewFamilyPositionInput,
    side: PreviewWindowSide,
) -> f64 {
    match side {
        PreviewWindowSide::Left => (input.group_x - input.screen_bounds.left).max(0.0),
        PreviewWindowSide::Right => {
            (input.screen_bounds.right() - (input.group_x + input.group_width)).max(0.0)
        }
    }
}

fn available_space_on_left(main_x: f64, screen_bounds: ScreenBounds) -> f64 {
    (main_x - PREVIEW_WINDOW_GAP - screen_bounds.left).max(0.0)
}

fn available_space_on_right(main_x: f64, main_width: f64, screen_bounds: ScreenBounds) -> f64 {
    (screen_bounds.right() - (main_x + main_width + PREVIEW_WINDOW_GAP)).max(0.0)
}

fn clamp_window_axis(value: f64, window_size: f64, min: f64, max: f64) -> f64 {
    if max - min <= window_size {
        return min;
    }

    value.clamp(min, max - window_size)
}

impl ScreenBounds {
    fn right(self) -> f64 {
        self.left + self.width
    }

    fn bottom(self) -> f64 {
        self.top + self.height
    }

    fn contains_point(self, x: f64, y: f64) -> bool {
        x >= self.left && x <= self.right() && y >= self.top && y <= self.bottom()
    }
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
        calculate_content_window_height, calculate_content_window_height_for_screen_bounds,
        calculate_tray_bottom_center_window_position, calculate_window_height,
        calculate_window_height_for_screen_bounds, choose_screen_bounds_for_tray_anchor,
        clamp_preview_height, clamp_preview_height_for_screen_bounds, clamp_preview_width,
        is_physical_point_in_rect, TrayWindowAnchor, TrayWindowPositionInput, MAX_WINDOW_HEIGHT,
    };
    use tauri::{PhysicalPosition, PhysicalSize, Rect};

    #[test]
    fn empty_state_height_has_expected_floor() {
        assert_eq!(calculate_window_height(0, 0), 309.0);
    }

    #[test]
    fn group_nav_height_is_included_when_multiple_groups_exist() {
        assert_eq!(calculate_window_height(10, 2), 533.0);
    }

    #[test]
    fn group_nav_height_counts_all_archive_rows_until_window_cap() {
        assert_eq!(calculate_window_height(10, 6), 645.0);
        assert_eq!(calculate_window_height(10, 7), 673.0);
    }

    #[test]
    fn list_height_is_capped_at_maximum() {
        assert_eq!(calculate_window_height(100, 10), MAX_WINDOW_HEIGHT);
    }

    #[test]
    fn list_height_is_capped_to_monitor_work_area() {
        let screen_bounds = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1440.0,
            height: 676.0,
        };

        assert_eq!(
            calculate_window_height_for_screen_bounds(100, 10, screen_bounds),
            676.0
        );
    }

    #[test]
    fn list_height_can_exceed_fallback_cap_on_a_tall_monitor() {
        let screen_bounds = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1024.0,
            height: 1100.0,
        };

        assert_eq!(
            calculate_window_height_for_screen_bounds(100, 10, screen_bounds),
            1100.0
        );
    }

    #[test]
    fn measured_content_height_is_used_for_tight_main_window_sizing() {
        assert_eq!(calculate_content_window_height(428.4), 429.0);
        assert_eq!(calculate_content_window_height(0.0), 220.0);
        assert_eq!(calculate_content_window_height(f64::NAN), 220.0);
        assert_eq!(calculate_content_window_height(1200.0), MAX_WINDOW_HEIGHT);
    }

    #[test]
    fn measured_content_height_is_capped_to_monitor_work_area() {
        let screen_bounds = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1440.0,
            height: 676.0,
        };

        assert_eq!(
            calculate_content_window_height_for_screen_bounds(820.0, screen_bounds),
            676.0
        );
    }

    #[test]
    fn measured_content_height_can_exceed_fallback_cap_on_a_tall_monitor() {
        let screen_bounds = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1024.0,
            height: 1100.0,
        };

        assert_eq!(
            calculate_content_window_height_for_screen_bounds(1040.0, screen_bounds),
            1040.0
        );
        assert_eq!(
            calculate_content_window_height_for_screen_bounds(1200.0, screen_bounds),
            1100.0
        );
    }

    #[test]
    fn tray_window_position_uses_tray_anchor_x_instead_of_screen_center() {
        let position = calculate_tray_bottom_center_window_position(TrayWindowPositionInput {
            anchor_x: 1850.0,
            anchor_y: 24.0,
            window_width: 320.0,
            window_height: 500.0,
            screen_bounds: super::ScreenBounds {
                left: 0.0,
                top: 24.0,
                width: 1920.0,
                height: 1056.0,
            },
        });

        assert_eq!(position.x, 1600);
        assert_eq!(position.y, 24);
    }

    #[test]
    fn tray_window_position_clamps_to_screen_edge_near_corner_icons() {
        let position = calculate_tray_bottom_center_window_position(TrayWindowPositionInput {
            anchor_x: 1910.0,
            anchor_y: 24.0,
            window_width: 320.0,
            window_height: 500.0,
            screen_bounds: super::ScreenBounds {
                left: 0.0,
                top: 24.0,
                width: 1920.0,
                height: 1056.0,
            },
        });

        assert_eq!(position.x, 1600);
        assert_eq!(position.y, 24);
    }

    #[test]
    fn tray_position_uses_screen_bounds_that_contain_the_anchor() {
        let primary = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1920.0,
            height: 1056.0,
        };
        let secondary = super::ScreenBounds {
            left: 1920.0,
            top: 24.0,
            width: 1920.0,
            height: 1056.0,
        };

        let bounds = choose_screen_bounds_for_tray_anchor(
            TrayWindowAnchor {
                x: 3700.0,
                y: 24.0,
                monitor_probe_y: 36.0,
            },
            &[primary, secondary],
            primary,
        );

        assert_eq!(bounds.left, secondary.left);
        assert_eq!(bounds.width, secondary.width);
    }

    #[test]
    fn tray_anchor_can_be_created_from_tray_rect_without_click_position() {
        let anchor = TrayWindowAnchor::from_rect(Rect {
            position: PhysicalPosition::new(1800, 24).into(),
            size: PhysicalSize::new(40, 24).into(),
        })
        .expect("tray rect should produce an anchor");

        assert_eq!(anchor.x, 1820.0);
        assert_eq!(anchor.y, 24.0);
        assert_eq!(anchor.monitor_probe_y, 36.0);
    }

    #[test]
    fn tray_anchor_uses_rect_center_when_click_position_is_inside_rect() {
        let anchor = TrayWindowAnchor::from_event(
            PhysicalPosition::new(1805.0, 36.0),
            Rect {
                position: PhysicalPosition::new(1800, 24).into(),
                size: PhysicalSize::new(40, 24).into(),
            },
        );

        assert_eq!(anchor.x, 1820.0);
        assert_eq!(anchor.y, 24.0);
        assert_eq!(anchor.monitor_probe_y, 36.0);
    }

    #[test]
    fn tray_anchor_keeps_rect_center_when_click_position_is_on_another_screen() {
        let anchor = TrayWindowAnchor::from_event(
            PhysicalPosition::new(2500.0, 36.0),
            Rect {
                position: PhysicalPosition::new(1800, 24).into(),
                size: PhysicalSize::new(40, 24).into(),
            },
        );

        assert_eq!(anchor.x, 1820.0);
        assert_eq!(anchor.y, 24.0);
        assert_eq!(anchor.monitor_probe_y, 36.0);
    }

    #[test]
    fn preview_width_is_clamped_to_supported_range() {
        assert_eq!(clamp_preview_width(10.0), 240.0);
        assert_eq!(clamp_preview_width(608.0), 608.0);
        assert_eq!(clamp_preview_width(2000.0), 680.0);
    }

    #[test]
    fn preview_height_is_clamped_to_supported_range() {
        assert_eq!(clamp_preview_height(10.0), 80.0);
        assert_eq!(clamp_preview_height(182.0), 182.0);
        assert_eq!(clamp_preview_height(2000.0), MAX_WINDOW_HEIGHT);
    }

    #[test]
    fn preview_height_is_capped_to_monitor_work_area() {
        let screen_bounds = super::ScreenBounds {
            left: 0.0,
            top: 24.0,
            width: 1440.0,
            height: 676.0,
        };

        assert_eq!(
            clamp_preview_height_for_screen_bounds(1200.0, screen_bounds),
            676.0
        );
    }

    #[test]
    fn preview_position_prefers_right_when_expanded_width_fits() {
        let position =
            super::calculate_preview_window_position(super::PreviewWindowPositionInput {
                main_x: 100.0,
                main_y: 40.0,
                anchor_top: 20.0,
                main_width: 320.0,
                preview_width: 320.0,
                preview_height: 220.0,
                required_preview_width: 632.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.side, super::PreviewWindowSide::Right);
        assert_eq!(position.x, 420.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_position_uses_left_when_expanded_width_would_overflow_right() {
        let position =
            super::calculate_preview_window_position(super::PreviewWindowPositionInput {
                main_x: 760.0,
                main_y: 40.0,
                anchor_top: 20.0,
                main_width: 320.0,
                preview_width: 320.0,
                preview_height: 220.0,
                required_preview_width: 632.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 440.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_position_keeps_left_group_stationary_when_expanded() {
        let position =
            super::calculate_preview_window_position(super::PreviewWindowPositionInput {
                main_x: 760.0,
                main_y: 40.0,
                anchor_top: 20.0,
                main_width: 320.0,
                preview_width: 632.0,
                preview_height: 220.0,
                required_preview_width: 632.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 128.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_position_clamps_when_window_is_taller_than_remaining_space() {
        let position =
            super::calculate_preview_window_position(super::PreviewWindowPositionInput {
                main_x: 100.0,
                main_y: 680.0,
                anchor_top: 80.0,
                main_width: 320.0,
                preview_width: 320.0,
                preview_height: 220.0,
                required_preview_width: 320.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.x, 420.0);
        assert_eq!(position.y, 580.0);
    }

    #[test]
    fn preview_family_places_detail_to_the_right_of_group() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 420.0,
                group_y: 60.0,
                detail_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.side, super::PreviewWindowSide::Right);
        assert_eq!(position.group.x, 420.0);
        assert_eq!(position.detail.x, 740.0);
        assert_eq!(position.detail.y, 60.0);
    }

    #[test]
    fn preview_family_places_detail_to_the_left_of_group() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 440.0,
                group_y: 60.0,
                detail_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Left,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.side, super::PreviewWindowSide::Left);
        assert_eq!(position.detail.x, 128.0);
        assert_eq!(position.group.x, 440.0);
        assert_eq!(position.detail.y, 60.0);
    }

    #[test]
    fn preview_detail_flips_across_stationary_group_when_outer_side_does_not_fit() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 860.0,
                group_y: 60.0,
                detail_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.side, super::PreviewWindowSide::Right);
        assert_eq!(position.group.x, 860.0);
        assert_eq!(position.detail.side, super::PreviewWindowSide::Left);
        assert_eq!(position.detail.x + 312.0, position.group.x);
    }

    #[test]
    fn preview_detail_can_cover_main_without_covering_stationary_group() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 0.0,
                group_y: 60.0,
                detail_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Left,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 640.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.side, super::PreviewWindowSide::Left);
        assert_eq!(position.group.x, 0.0);
        assert_eq!(position.detail.side, super::PreviewWindowSide::Right);
        assert_eq!(position.detail.x, 320.0);
    }

    #[test]
    fn preview_detail_clamps_vertically_without_moving_group() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 420.0,
                group_y: 720.0,
                detail_y: 720.0,
                group_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.y, 720.0);
        assert_eq!(position.detail.y, 580.0);
    }

    #[test]
    fn preview_detail_uses_the_active_group_row_anchor() {
        let position =
            super::calculate_preview_family_position(super::PreviewFamilyPositionInput {
                group_x: 420.0,
                group_y: 60.0,
                detail_y: 248.0,
                group_width: 320.0,
                detail_width: 304.0,
                detail_height: 220.0,
                preferred_side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.group.y, 60.0);
        assert_eq!(position.detail.y, 248.0);
        assert_eq!(position.detail.x, position.group.x + 320.0);
    }

    #[test]
    fn measured_group_resize_preserves_left_side_horizontal_position() {
        let position =
            super::calculate_preview_window_resize_position(super::PreviewWindowResizeInput {
                current_x: 312.0,
                current_y: 600.0,
                main_x: 320.0,
                preview_height: 358.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 640.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 312.0);
        assert_eq!(position.y, 442.0);
    }

    #[test]
    fn measured_group_resize_preserves_right_side_horizontal_position() {
        let position =
            super::calculate_preview_window_resize_position(super::PreviewWindowResizeInput {
                current_x: 740.0,
                current_y: 720.0,
                main_x: 100.0,
                preview_height: 220.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            });

        assert_eq!(position.side, super::PreviewWindowSide::Right);
        assert_eq!(position.x, 740.0);
        assert_eq!(position.y, 580.0);
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
