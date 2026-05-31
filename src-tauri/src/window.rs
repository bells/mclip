//! 主窗口与 preview 窗口的尺寸、定位和显示隐藏规则。
//! 主窗口只承载左侧列表；分组预览拆到独立透明窗口，避免撑大主窗口。

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, Position, Size};
use tauri_plugin_positioner::{Position as TrayPosition, WindowExt};

#[cfg(target_os = "macos")]
use raw_window_handle::HasWindowHandle;

pub const WINDOW_WIDTH: f64 = 320.0;
pub const MAX_WINDOW_HEIGHT: f64 = 900.0;
pub const MAIN_WINDOW_SHOWN_EVENT: &str = "main-window-shown";
const HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT: &str = "history-preview-placement-updated";
const PREVIEW_WINDOW_LABEL: &str = "preview";
const PREVIEW_DETAIL_WINDOW_LABEL: &str = "preview-detail";
const ABOUT_WINDOW_LABEL: &str = "about";
const PREFERENCES_WINDOW_LABEL: &str = "preferences";

const HEADER_HEIGHT: f64 = 56.0;
const GROUP_ROW_HEIGHT: f64 = 52.0;
const MAX_VISIBLE_ARCHIVE_GROUP_ROWS: u32 = 5;
const FOOTER_HEIGHT: f64 = 144.0;
const PER_ITEM_HEIGHT: f64 = 34.0;
const EMPTY_STATE_HEIGHT: f64 = 120.0;
const MIN_PREVIEW_WINDOW_WIDTH: f64 = 240.0;
const MAX_PREVIEW_WINDOW_WIDTH: f64 = 680.0;
const MIN_PREVIEW_WINDOW_HEIGHT: f64 = 120.0;
// Keep the preview flush with the main window so the pointer can cross into it
// without passing through a dead hover gap.
const PREVIEW_WINDOW_GAP: f64 = 0.0;
const FALLBACK_SCREEN_BOUNDS_SIZE: f64 = 200_000.0;

#[derive(Debug, Clone, Copy)]
pub enum WindowPlacement {
    Center,
    Tray,
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
struct PreviewDetailWindowPositionInput {
    preview_x: f64,
    preview_y: f64,
    preview_width: f64,
    detail_width: f64,
    detail_height: f64,
    side: PreviewWindowSide,
    screen_bounds: ScreenBounds,
}

#[derive(Debug, Clone, Copy)]
struct GroupPreviewWithDetailWindowPositionInput {
    group_x: f64,
    group_y: f64,
    group_width: f64,
    detail_width: f64,
    preview_height: f64,
    screen_bounds: ScreenBounds,
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
    required_preview_width: f64,
) -> Result<PreviewWindowPosition, String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_window_position());
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
    let clamped_preview_width = clamp_preview_width(preview_width);
    let clamped_preview_height = clamp_preview_height(preview_height);
    let clamped_required_width =
        clamp_preview_width(required_preview_width.max(clamped_preview_width));
    let screen_bounds = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| monitor_work_area_bounds(&monitor))
        .unwrap_or_else(|| fallback_screen_bounds(main_position.x, main_position.y));
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
    preview_window.show().map_err(|error| error.to_string())?;

    Ok(position)
}

#[tauri::command]
pub fn show_history_group_preview_with_detail_window(
    app_handle: AppHandle,
    group_x: f64,
    group_y: f64,
    preview_height: f64,
    group_width: f64,
    detail_width: f64,
) -> Result<PreviewWindowPosition, String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_window_position());
    };

    hide_history_preview_detail_window(app_handle.clone())?;

    let scale_factor = main_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(scale_factor);
    let screen_bounds = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| monitor_work_area_bounds(&monitor))
        .unwrap_or_else(|| fallback_screen_bounds(main_position.x, main_position.y));
    let clamped_group_width = clamp_preview_width(group_width);
    let clamped_detail_width = clamp_preview_width(detail_width);
    let clamped_preview_height = clamp_preview_height(preview_height);
    let preview_width = clamped_group_width + clamped_detail_width;
    let position = calculate_group_preview_with_detail_window_position(
        GroupPreviewWithDetailWindowPositionInput {
            group_x,
            group_y,
            group_width: clamped_group_width,
            detail_width: clamped_detail_width,
            preview_height: clamped_preview_height,
            screen_bounds,
        },
    );

    preview_window
        .set_size(Size::Logical(LogicalSize {
            width: preview_width,
            height: clamped_preview_height,
        }))
        .map_err(|error| error.to_string())?;
    preview_window
        .set_position(Position::Logical(LogicalPosition {
            x: position.x,
            y: position.y,
        }))
        .map_err(|error| error.to_string())?;
    preview_window.show().map_err(|error| error.to_string())?;

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
pub fn show_history_preview_detail_window(
    app_handle: AppHandle,
    detail_height: f64,
    detail_width: f64,
    preview_width: f64,
) -> Result<PreviewWindowPosition, String> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_window) = app_handle.get_webview_window(PREVIEW_WINDOW_LABEL) else {
        return Ok(default_preview_window_position());
    };
    let Some(preview_detail_window) = app_handle.get_webview_window(PREVIEW_DETAIL_WINDOW_LABEL)
    else {
        return Ok(default_preview_window_position());
    };
    let preview_scale_factor = preview_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let main_scale_factor = main_window
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(main_scale_factor);
    let preview_position = preview_window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(preview_scale_factor);
    let clamped_detail_width = clamp_preview_width(detail_width);
    let clamped_detail_height = clamp_preview_height(detail_height);
    let clamped_preview_width = clamp_preview_width(preview_width);
    let side = if preview_position.x < main_position.x {
        PreviewWindowSide::Left
    } else {
        PreviewWindowSide::Right
    };
    let screen_bounds = main_window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| monitor_work_area_bounds(&monitor))
        .unwrap_or_else(|| fallback_screen_bounds(main_position.x, main_position.y));
    let position = calculate_preview_detail_window_position(PreviewDetailWindowPositionInput {
        preview_x: preview_position.x,
        preview_y: preview_position.y,
        preview_width: clamped_preview_width,
        detail_width: clamped_detail_width,
        detail_height: clamped_detail_height,
        side,
        screen_bounds,
    });

    preview_detail_window
        .set_size(Size::Logical(LogicalSize {
            width: clamped_detail_width,
            height: clamped_detail_height,
        }))
        .map_err(|error| error.to_string())?;
    preview_detail_window
        .set_position(Position::Logical(LogicalPosition {
            x: position.x,
            y: position.y,
        }))
        .map_err(|error| error.to_string())?;
    preview_detail_window
        .emit(HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT, position)
        .map_err(|error| error.to_string())?;
    preview_detail_window
        .show()
        .map_err(|error| error.to_string())?;

    Ok(position)
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
    let visible_archive_group_count = group_count
        .saturating_sub(1)
        .min(MAX_VISIBLE_ARCHIVE_GROUP_ROWS);
    let group_rows_height = visible_archive_group_count as f64 * GROUP_ROW_HEIGHT;

    (HEADER_HEIGHT + group_rows_height + FOOTER_HEIGHT + content_height).min(MAX_WINDOW_HEIGHT)
}

fn clamp_preview_width(width: f64) -> f64 {
    width.clamp(MIN_PREVIEW_WINDOW_WIDTH, MAX_PREVIEW_WINDOW_WIDTH)
}

fn clamp_preview_height(height: f64) -> f64 {
    height.clamp(MIN_PREVIEW_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT)
}

fn default_preview_window_position() -> PreviewWindowPosition {
    PreviewWindowPosition {
        x: 0.0,
        y: 0.0,
        side: PreviewWindowSide::Right,
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

fn fallback_screen_bounds(main_x: f64, main_y: f64) -> ScreenBounds {
    let half_size = FALLBACK_SCREEN_BOUNDS_SIZE / 2.0;

    ScreenBounds {
        left: main_x - half_size,
        top: main_y - half_size,
        width: FALLBACK_SCREEN_BOUNDS_SIZE,
        height: FALLBACK_SCREEN_BOUNDS_SIZE,
    }
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

fn calculate_preview_detail_window_position(
    input: PreviewDetailWindowPositionInput,
) -> PreviewWindowPosition {
    let side = choose_preview_detail_window_side(input);
    let x = clamp_window_axis(
        calculate_preview_detail_window_x(input, side),
        input.detail_width,
        input.screen_bounds.left,
        input.screen_bounds.right(),
    );

    PreviewWindowPosition {
        x,
        y: clamp_window_axis(
            input.preview_y,
            input.detail_height,
            input.screen_bounds.top,
            input.screen_bounds.bottom(),
        ),
        side,
    }
}

fn choose_preview_detail_window_side(input: PreviewDetailWindowPositionInput) -> PreviewWindowSide {
    if preview_detail_window_fits_on_side(input, input.side) {
        return input.side;
    }

    let opposite_side = match input.side {
        PreviewWindowSide::Left => PreviewWindowSide::Right,
        PreviewWindowSide::Right => PreviewWindowSide::Left,
    };

    if preview_detail_window_fits_on_side(input, opposite_side) {
        return opposite_side;
    }

    if available_preview_detail_space(input, PreviewWindowSide::Right)
        >= available_preview_detail_space(input, PreviewWindowSide::Left)
    {
        PreviewWindowSide::Right
    } else {
        PreviewWindowSide::Left
    }
}

fn preview_detail_window_fits_on_side(
    input: PreviewDetailWindowPositionInput,
    side: PreviewWindowSide,
) -> bool {
    let x = calculate_preview_detail_window_x(input, side);

    x >= input.screen_bounds.left && x + input.detail_width <= input.screen_bounds.right()
}

fn calculate_preview_detail_window_x(
    input: PreviewDetailWindowPositionInput,
    side: PreviewWindowSide,
) -> f64 {
    match side {
        PreviewWindowSide::Left => input.preview_x - input.detail_width,
        PreviewWindowSide::Right => input.preview_x + input.preview_width,
    }
}

fn available_preview_detail_space(
    input: PreviewDetailWindowPositionInput,
    side: PreviewWindowSide,
) -> f64 {
    match side {
        PreviewWindowSide::Left => (input.preview_x - input.screen_bounds.left).max(0.0),
        PreviewWindowSide::Right => {
            (input.screen_bounds.right() - (input.preview_x + input.preview_width)).max(0.0)
        }
    }
}

fn calculate_group_preview_with_detail_window_position(
    input: GroupPreviewWithDetailWindowPositionInput,
) -> PreviewWindowPosition {
    let side = choose_group_preview_detail_side(input);
    let preview_width = input.group_width + input.detail_width;
    let x = match side {
        PreviewWindowSide::Left => input.group_x - input.detail_width,
        PreviewWindowSide::Right => input.group_x,
    };

    PreviewWindowPosition {
        x: clamp_window_axis(
            x,
            preview_width,
            input.screen_bounds.left,
            input.screen_bounds.right(),
        ),
        y: clamp_window_axis(
            input.group_y,
            input.preview_height,
            input.screen_bounds.top,
            input.screen_bounds.bottom(),
        ),
        side,
    }
}

fn choose_group_preview_detail_side(
    input: GroupPreviewWithDetailWindowPositionInput,
) -> PreviewWindowSide {
    let right_fits =
        input.group_x + input.group_width + input.detail_width <= input.screen_bounds.right();
    if right_fits {
        return PreviewWindowSide::Right;
    }

    let left_fits = input.group_x - input.detail_width >= input.screen_bounds.left;
    if left_fits {
        return PreviewWindowSide::Left;
    }

    if available_group_preview_detail_space(input, PreviewWindowSide::Right)
        >= available_group_preview_detail_space(input, PreviewWindowSide::Left)
    {
        PreviewWindowSide::Right
    } else {
        PreviewWindowSide::Left
    }
}

fn available_group_preview_detail_space(
    input: GroupPreviewWithDetailWindowPositionInput,
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
    fn group_nav_height_only_counts_five_archive_rows() {
        assert_eq!(calculate_window_height(10, 6), 800.0);
        assert_eq!(calculate_window_height(10, 7), 800.0);
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
    fn preview_detail_position_appears_right_of_group_preview() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 420.0,
                preview_y: 60.0,
                preview_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Right);
        assert_eq!(position.x, 740.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_detail_position_appears_left_of_group_preview() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 440.0,
                preview_y: 60.0,
                preview_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Left,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 128.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_detail_position_clamps_to_screen_bottom() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 420.0,
                preview_y: 720.0,
                preview_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.x, 740.0);
        assert_eq!(position.y, 580.0);
    }

    #[test]
    fn preview_detail_position_flips_left_instead_of_covering_group_preview() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 860.0,
                preview_y: 60.0,
                preview_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 548.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_detail_position_flips_right_instead_of_covering_group_preview() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 140.0,
                preview_y: 60.0,
                preview_width: 320.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Left,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Right);
        assert_eq!(position.x, 460.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn preview_detail_position_stays_on_screen_when_neither_side_fits() {
        let position = super::calculate_preview_detail_window_position(
            super::PreviewDetailWindowPositionInput {
                preview_x: 180.0,
                preview_y: 60.0,
                preview_width: 220.0,
                detail_width: 312.0,
                detail_height: 220.0,
                side: super::PreviewWindowSide::Right,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 500.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 0.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn group_preview_with_detail_keeps_group_as_left_anchor_when_detail_fits_right() {
        let position = super::calculate_group_preview_with_detail_window_position(
            super::GroupPreviewWithDetailWindowPositionInput {
                group_x: 420.0,
                group_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                preview_height: 422.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Right);
        assert_eq!(position.x, 420.0);
        assert_eq!(position.y, 60.0);
    }

    #[test]
    fn group_preview_with_detail_expands_left_when_detail_would_cover_group() {
        let position = super::calculate_group_preview_with_detail_window_position(
            super::GroupPreviewWithDetailWindowPositionInput {
                group_x: 860.0,
                group_y: 60.0,
                group_width: 320.0,
                detail_width: 312.0,
                preview_height: 422.0,
                screen_bounds: super::ScreenBounds {
                    left: 0.0,
                    top: 0.0,
                    width: 1200.0,
                    height: 800.0,
                },
            },
        );

        assert_eq!(position.side, super::PreviewWindowSide::Left);
        assert_eq!(position.x, 548.0);
        assert_eq!(position.y, 60.0);
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
