//! 剪贴板读写与监听。
//! Windows 使用系统剪贴板事件；macOS 轻量轮询 NSPasteboard.changeCount；
//! 其它平台保留完整轮询，并且每次读取都重新打开剪贴板以降低句柄失效风险。

use std::borrow::Cow;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;

use arboard::{Clipboard, ImageData};
use base64::prelude::*;
use image::imageops::{self, FilterType};
use image::RgbaImage;
use image::{codecs::png::PngEncoder, ColorType, ImageEncoder};
use tauri::{AppHandle, State};

use crate::auto_paste::{activate_paste_target_on_main_thread, AutoPasteTargetState};
use crate::diagnostics::log_error;
use crate::history::{
    emit_history_updated, find_history_item, hash_hex, process_new_history_item, HistoryEntry,
    NewHistoryItem,
};
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
use crate::settings::load_settings;
use crate::settings::HistoryTypes;

#[cfg(not(target_os = "windows"))]
const CLIPBOARD_POLL_INTERVAL_MS: u64 = 500;
#[cfg(target_os = "macos")]
const CLIPBOARD_CHANGE_SETTLE_DELAY_MS: u64 = 75;
const AUTO_PASTE_DELAY_MS: u64 = 120;
const AUTO_PASTE_AFTER_ACTIVATION_DELAY_MS: u64 = 80;
const MAX_IMAGE_DIMENSION: u32 = 1200;

#[tauri::command]
pub fn copy_history_item(app_handle: AppHandle, id: String) -> Result<(), String> {
    let Some(history_item) = find_history_item(&app_handle, &id)? else {
        return Err("history item not found".to_string());
    };

    write_history_item_to_clipboard(history_item)
}

#[tauri::command]
pub fn paste_current_clipboard(
    app_handle: AppHandle,
    paste_target_state: State<'_, AutoPasteTargetState>,
) -> Result<(), String> {
    let paste_target = paste_target_state.take();

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(AUTO_PASTE_DELAY_MS));

        if let Err(error) = ensure_system_paste_permission() {
            log_error(
                &app_handle,
                "clipboard",
                &format!("failed to prepare auto paste permission: {error}"),
            );
            return;
        }

        if let Err(error) = activate_paste_target_on_main_thread(&app_handle, paste_target) {
            log_error(
                &app_handle,
                "clipboard",
                &format!("failed to activate auto paste target: {error}"),
            );
            return;
        }

        thread::sleep(Duration::from_millis(AUTO_PASTE_AFTER_ACTIVATION_DELAY_MS));

        if let Err(error) = trigger_system_paste() {
            log_error(
                &app_handle,
                "clipboard",
                &format!("failed to auto paste clipboard content: {error}"),
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_image_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    Ok(BASE64_STANDARD.encode(&bytes))
}

pub fn spawn_clipboard_watcher(app_handle: AppHandle) {
    spawn_platform_clipboard_watcher(app_handle);
}

// 统一处理平台监听得到的新内容：去重、写入历史、通知前端刷新。
fn process_clipboard_snapshot(
    app_handle: &AppHandle,
    last_signature: &mut String,
    snapshot: ClipboardSnapshot,
) {
    if snapshot.signature == *last_signature {
        return;
    }

    *last_signature = snapshot.signature;

    match process_new_history_item(app_handle, snapshot.item) {
        Ok(Some(updated_history)) => {
            if let Err(error) = emit_history_updated(app_handle, &updated_history) {
                log_error(
                    app_handle,
                    "clipboard",
                    &format!("failed to emit history update: {error}"),
                );
            }
        }
        Ok(None) => {}
        Err(error) => {
            log_error(
                app_handle,
                "clipboard",
                &format!("failed to process clipboard history: {error}"),
            );
        }
    }
}

pub(crate) fn write_history_item_to_clipboard(history_item: HistoryEntry) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;

    match history_item {
        HistoryEntry::Text { text, .. } => {
            clipboard.set_text(text).map_err(|error| error.to_string())
        }
        HistoryEntry::Files { file_paths, .. } => {
            let paths = clipboard_file_list_paths(file_paths);
            clipboard
                .set()
                .file_list(&paths)
                .map_err(|error| error.to_string())
        }
        HistoryEntry::Image { image_path, .. } => {
            let png_bytes = std::fs::read(image_path).map_err(|error| error.to_string())?;
            let image = image::load_from_memory(&png_bytes)
                .map_err(|error| error.to_string())?
                .to_rgba8();
            let (width, height) = image.dimensions();

            clipboard
                .set_image(ImageData {
                    width: width as usize,
                    height: height as usize,
                    bytes: Cow::Owned(image.into_raw()),
                })
                .map_err(|error| error.to_string())
        }
    }
}

#[cfg(target_os = "macos")]
fn trigger_system_paste() -> Result<(), String> {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    const V_KEY_CODE: u16 = 9;

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "failed to create macOS event source".to_string())?;
    let key_down = CGEvent::new_keyboard_event(source.clone(), V_KEY_CODE, true)
        .map_err(|_| "failed to create macOS paste key down event".to_string())?;
    let key_up = CGEvent::new_keyboard_event(source, V_KEY_CODE, false)
        .map_err(|_| "failed to create macOS paste key up event".to_string())?;

    key_down.set_flags(CGEventFlags::CGEventFlagCommand);
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);
    key_down.post(CGEventTapLocation::HID);
    key_up.post(CGEventTapLocation::HID);

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn ensure_system_paste_permission() -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn ensure_system_paste_permission() -> Result<(), String> {
    let already_allowed = macos_preflight_post_event_access();
    let allowed_after_request = if already_allowed {
        false
    } else {
        macos_request_post_event_access()
    };

    macos_auto_paste_access_result(already_allowed, allowed_after_request)
}

#[cfg(target_os = "macos")]
fn macos_preflight_post_event_access() -> bool {
    unsafe { CGPreflightPostEventAccess() }
}

#[cfg(target_os = "macos")]
fn macos_request_post_event_access() -> bool {
    unsafe { CGRequestPostEventAccess() }
}

#[cfg(any(target_os = "macos", test))]
fn macos_auto_paste_access_result(
    already_allowed: bool,
    allowed_after_request: bool,
) -> Result<(), String> {
    if already_allowed || allowed_after_request {
        return Ok(());
    }

    Err(
        "macOS Accessibility permission is required to auto paste clipboard content"
            .to_string(),
    )
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGPreflightPostEventAccess() -> bool;
    fn CGRequestPostEventAccess() -> bool;
}

#[cfg(target_os = "windows")]
fn trigger_system_paste() -> Result<(), String> {
    use std::mem::size_of;

    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL, VK_V,
    };

    fn keyboard_input(virtual_key: u16, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: virtual_key,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    let inputs = [
        keyboard_input(VK_CONTROL, 0),
        keyboard_input(VK_V, 0),
        keyboard_input(VK_V, KEYEVENTF_KEYUP),
        keyboard_input(VK_CONTROL, KEYEVENTF_KEYUP),
    ];
    let sent_count = unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            size_of::<INPUT>() as i32,
        )
    };

    if sent_count == inputs.len() as u32 {
        Ok(())
    } else {
        Err(format!(
            "Windows SendInput sent {sent_count} of {} events",
            inputs.len()
        ))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn trigger_system_paste() -> Result<(), String> {
    Err("auto paste is not supported on this platform".to_string())
}

struct ClipboardSnapshot {
    signature: String,
    item: NewHistoryItem,
}

fn read_clipboard_snapshot(enabled_types: &HistoryTypes) -> Option<ClipboardSnapshot> {
    if enabled_types.files {
        if let Ok(file_paths) = read_clipboard_files() {
            if !file_paths.is_empty() {
                // Finder 拷贝单张图片时剪贴板上只有文件引用，没有像素数据。
                // 检测到单张常见图片格式时直接读取文件内容生成 image 条目，
                // 这样历史列表里能正常展示缩略图。
                if file_paths.len() == 1 && enabled_types.image {
                    if let Ok(item) = read_image_from_file(&file_paths[0]) {
                        return Some(ClipboardSnapshot {
                            signature: item.dedupe_key(),
                            item,
                        });
                    }
                }

                let item = NewHistoryItem::Files(file_paths);
                return clipboard_snapshot_from_candidates(Some(item), None, None);
            }
        }
    }

    if enabled_types.image {
        if let Ok(item) = read_clipboard_image() {
            return clipboard_snapshot_from_candidates(None, Some(item), None);
        }
    }

    if enabled_types.text || enabled_types.files {
        if let Ok(text) = read_clipboard_text() {
            if let Some(item) = text_to_history_item(text, enabled_types) {
                return clipboard_snapshot_from_candidates(None, None, Some(item));
            }
        }
    }

    None
}

fn clipboard_snapshot_from_candidates(
    file_item: Option<NewHistoryItem>,
    image_item: Option<NewHistoryItem>,
    text_item: Option<NewHistoryItem>,
) -> Option<ClipboardSnapshot> {
    file_item
        .or(image_item)
        .or(text_item)
        .map(|item| ClipboardSnapshot {
            signature: item.dedupe_key(),
            item,
        })
}

fn read_clipboard_signature(enabled_types: &HistoryTypes) -> String {
    read_clipboard_snapshot(enabled_types)
        .map(|snapshot| snapshot.signature)
        .unwrap_or_default()
}

#[cfg(any(target_os = "macos", test))]
fn read_snapshot_after_change_token_update(
    last_change_token: &mut i64,
    current_change_token: Option<i64>,
    read_snapshot: impl FnOnce() -> Option<ClipboardSnapshot>,
) -> Option<ClipboardSnapshot> {
    match current_change_token {
        Some(change_token) if change_token == *last_change_token => None,
        Some(change_token) => {
            *last_change_token = change_token;
            read_snapshot()
        }
        None => read_snapshot(),
    }
}

fn read_clipboard_text() -> Result<String, String> {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_text())
        .map_err(|error| error.to_string())
}

fn read_clipboard_files() -> Result<Vec<String>, String> {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.get().file_list())
        .map(|paths| {
            paths
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect()
        })
        .map_err(|error| error.to_string())
}

fn clipboard_file_list_paths(file_paths: Vec<String>) -> Vec<PathBuf> {
    file_paths
        .into_iter()
        .map(|path| file_url_to_path(&path).unwrap_or(path))
        .map(PathBuf::from)
        .collect()
}

fn read_clipboard_image() -> Result<NewHistoryItem, String> {
    let clipboard_image = Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_image())
        .map_err(|error| error.to_string())?;

    let mut rgba = RgbaImage::from_raw(
        clipboard_image.width as u32,
        clipboard_image.height as u32,
        clipboard_image.bytes.as_ref().to_vec(),
    )
    .ok_or_else(|| "failed to create image from raw clipboard pixels".to_string())?;

    normalize_suspicious_clipboard_alpha(&mut rgba);

    let (resized, final_width, final_height) = resize_if_large(rgba, MAX_IMAGE_DIMENSION);
    let png_bytes = encode_png_rgba(&resized)?;
    let content_hash = hash_hex(&png_bytes);

    Ok(NewHistoryItem::Image {
        png_bytes,
        width: final_width,
        height: final_height,
        content_hash,
    })
}

fn normalize_suspicious_clipboard_alpha(image: &mut RgbaImage) -> bool {
    let raw = image.as_raw();
    let pixel_count = raw.len() / 4;

    if pixel_count == 0 {
        return false;
    }

    let mut transparent_pixels = 0usize;
    let mut visible_rgb_pixels = 0usize;

    for pixel in raw.chunks_exact(4) {
        let [red, green, blue, alpha] = pixel else {
            continue;
        };

        if *alpha == 0 {
            transparent_pixels += 1;
        }

        if *red > 8 || *green > 8 || *blue > 8 {
            visible_rgb_pixels += 1;
        }
    }

    let almost_all_transparent = transparent_pixels.saturating_mul(100) >= pixel_count * 99;
    let has_meaningful_rgb = visible_rgb_pixels.saturating_mul(100) >= pixel_count;

    if !almost_all_transparent || !has_meaningful_rgb {
        return false;
    }

    for pixel in image.pixels_mut() {
        if pixel.0[3] == 0 {
            pixel.0[3] = 255;
        }
    }

    true
}

fn read_image_from_file(path: &str) -> Result<NewHistoryItem, String> {
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;

    let img = image::load_from_memory(&bytes).map_err(|error| error.to_string())?;
    let rgba = img.to_rgba8();
    let (resized, final_width, final_height) = resize_if_large(rgba, MAX_IMAGE_DIMENSION);
    let png_bytes = encode_png_rgba(&resized)?;
    let content_hash = hash_hex(&png_bytes);

    Ok(NewHistoryItem::Image {
        png_bytes,
        width: final_width,
        height: final_height,
        content_hash,
    })
}

fn resize_if_large(img: RgbaImage, max_dim: u32) -> (RgbaImage, u32, u32) {
    let (width, height) = img.dimensions();

    if width <= max_dim && height <= max_dim {
        return (img, width, height);
    }

    let (new_w, new_h) = if width > height {
        let ratio = max_dim as f64 / width as f64;
        (max_dim, (height as f64 * ratio) as u32)
    } else {
        let ratio = max_dim as f64 / height as f64;
        ((width as f64 * ratio) as u32, max_dim)
    };

    let resized = imageops::resize(&img, new_w, new_h, FilterType::Lanczos3);
    (resized, new_w, new_h)
}

fn encode_png_rgba(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let (width, height) = image.dimensions();
    let mut png_bytes = Vec::new();
    let encoder = PngEncoder::new(&mut png_bytes);

    encoder
        .write_image(image.as_raw(), width, height, ColorType::Rgba8.into())
        .map_err(|error| error.to_string())?;

    Ok(png_bytes)
}

fn text_to_history_item(text: String, enabled_types: &HistoryTypes) -> Option<NewHistoryItem> {
    let trimmed_text = text.trim();

    if trimmed_text.is_empty() {
        return None;
    }

    if trimmed_text.starts_with("mclip diagnostics") {
        return None;
    }

    if enabled_types.files {
        if let Some(file_paths) = file_url_text_to_paths(trimmed_text) {
            return Some(NewHistoryItem::Files(file_paths));
        }
    }

    if enabled_types.text {
        Some(NewHistoryItem::Text(text))
    } else {
        None
    }
}

fn file_url_text_to_paths(text: &str) -> Option<Vec<String>> {
    let mut file_paths = Vec::new();

    for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        file_paths.push(file_url_to_path(line)?);
    }

    if file_paths.is_empty() {
        None
    } else {
        Some(file_paths)
    }
}

fn file_url_to_path(value: &str) -> Option<String> {
    let value = value.trim();
    if !value.get(..5)?.eq_ignore_ascii_case("file:") {
        return None;
    }

    let after_scheme = value.get(5..)?;
    let path_part = match after_scheme.strip_prefix("//") {
        Some(after_slashes) if after_slashes.starts_with('/') => after_slashes,
        Some(after_slashes) => {
            if let Some(local_path) = after_slashes.strip_prefix("localhost/") {
                return percent_decode_file_path(&format!("/{local_path}"))
                    .map(normalize_file_url_path);
            }

            return percent_decode_file_path(&format!("//{after_slashes}"))
                .map(normalize_file_url_path);
        }
        None => after_scheme,
    };

    percent_decode_file_path(path_part).map(normalize_file_url_path)
}

fn percent_decode_file_path(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = hex_value(*bytes.get(index + 1)?)?;
            let low = hex_value(*bytes.get(index + 2)?)?;
            decoded.push((high << 4) | low);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    String::from_utf8(decoded).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn normalize_file_url_path(path: String) -> String {
    let bytes = path.as_bytes();

    if bytes.len() >= 3 && bytes[0] == b'/' && bytes[2] == b':' {
        path[1..].to_string()
    } else {
        path
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_signature = load_settings(&app_handle)
            .map(|settings| read_clipboard_signature(&settings.enabled_history_types))
            .unwrap_or_default();

        loop {
            // 其它平台保留完整轮询。每轮独立读取，避免长时间持有 Clipboard 导致后续读取不稳定。
            if let Ok(settings) = load_settings(&app_handle) {
                if let Some(snapshot) = read_clipboard_snapshot(&settings.enabled_history_types) {
                    process_clipboard_snapshot(&app_handle, &mut last_signature, snapshot);
                }
            }

            thread::sleep(Duration::from_millis(CLIPBOARD_POLL_INTERVAL_MS));
        }
    });
}

#[cfg(target_os = "macos")]
mod macos_clipboard_watcher {
    //! macOS 没有等价于 Windows WM_CLIPBOARDUPDATE 的公开全局事件。
    //! 这里轻量轮询 NSPasteboard.changeCount，只有计数变化时才读取完整剪贴板。

    use std::ffi::{c_char, c_void};
    use std::thread;
    use std::time::Duration;

    use tauri::AppHandle;

    use crate::settings::load_settings;

    use super::{
        process_clipboard_snapshot, read_clipboard_signature, read_clipboard_snapshot,
        read_snapshot_after_change_token_update, CLIPBOARD_CHANGE_SETTLE_DELAY_MS,
        CLIPBOARD_POLL_INTERVAL_MS,
    };

    pub fn spawn(app_handle: AppHandle) {
        thread::spawn(move || {
            let mut last_signature = load_settings(&app_handle)
                .map(|settings| read_clipboard_signature(&settings.enabled_history_types))
                .unwrap_or_default();
            let mut last_change_token = general_pasteboard_change_count().unwrap_or_default();

            loop {
                if let Ok(settings) = load_settings(&app_handle) {
                    let current_change_token = general_pasteboard_change_count();
                    if current_change_token
                        .map(|change_token| change_token != last_change_token)
                        .unwrap_or(false)
                    {
                        thread::sleep(Duration::from_millis(CLIPBOARD_CHANGE_SETTLE_DELAY_MS));
                    }

                    if let Some(snapshot) = read_snapshot_after_change_token_update(
                        &mut last_change_token,
                        current_change_token,
                        || read_clipboard_snapshot(&settings.enabled_history_types),
                    ) {
                        process_clipboard_snapshot(&app_handle, &mut last_signature, snapshot);
                    }
                }

                thread::sleep(Duration::from_millis(CLIPBOARD_POLL_INTERVAL_MS));
            }
        });
    }

    fn general_pasteboard_change_count() -> Option<i64> {
        unsafe {
            let pasteboard_class = objc_getClass(c"NSPasteboard".as_ptr());
            if pasteboard_class.is_null() {
                return None;
            }

            let pasteboard = msg_send_id(pasteboard_class, sel(c"generalPasteboard".as_ptr()));
            if pasteboard.is_null() {
                return None;
            }

            Some(msg_send_integer(pasteboard, sel(c"changeCount".as_ptr())) as i64)
        }
    }

    type ObjcId = *mut c_void;

    #[link(name = "AppKit", kind = "framework")]
    unsafe extern "C" {}

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
        fn msg_send_integer(receiver: ObjcId, selector: ObjcId) -> isize;
    }
}

#[cfg(target_os = "macos")]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    macos_clipboard_watcher::spawn(app_handle);
}

#[cfg(target_os = "windows")]
mod windows_clipboard_watcher {
    //! Windows 剪贴板事件监听。
    //! 这里没有引入额外 crate，而是用最小 Win32 FFI 创建 message-only window 接收 WM_CLIPBOARDUPDATE。

    use std::ffi::c_void;
    use std::ptr;
    use std::sync::mpsc::{self, Sender};
    use std::sync::{Mutex, OnceLock};
    use std::thread;

    use tauri::AppHandle;

    use crate::diagnostics::log_error;
    use crate::settings::load_settings;

    use super::{process_clipboard_snapshot, read_clipboard_signature, read_clipboard_snapshot};

    type Bool = i32;
    type Hinstance = isize;
    type Hwnd = isize;
    type Lparam = isize;
    type Lresult = isize;
    type Wparam = usize;
    type Wndproc = Option<unsafe extern "system" fn(Hwnd, u32, Wparam, Lparam) -> Lresult>;

    const HWND_MESSAGE: Hwnd = -3;
    const WM_CLIPBOARDUPDATE: u32 = 0x031D;

    #[repr(C)]
    #[derive(Default)]
    #[allow(dead_code)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    #[allow(dead_code)]
    struct Msg {
        hwnd: Hwnd,
        message: u32,
        w_param: Wparam,
        l_param: Lparam,
        time: u32,
        pt: Point,
        l_private: u32,
    }

    #[repr(C)]
    #[allow(dead_code)]
    struct WndClassW {
        style: u32,
        lpfn_wnd_proc: Wndproc,
        cb_cls_extra: i32,
        cb_wnd_extra: i32,
        h_instance: Hinstance,
        h_icon: isize,
        h_cursor: isize,
        hbr_background: isize,
        lpsz_menu_name: *const u16,
        lpsz_class_name: *const u16,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        #[link_name = "GetModuleHandleW"]
        fn get_module_handle_w(module_name: *const u16) -> Hinstance;
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        #[link_name = "AddClipboardFormatListener"]
        fn add_clipboard_format_listener(hwnd: Hwnd) -> Bool;
        #[link_name = "CreateWindowExW"]
        fn create_window_ex_w(
            ex_style: u32,
            class_name: *const u16,
            window_name: *const u16,
            style: u32,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
            parent: Hwnd,
            menu: isize,
            instance: Hinstance,
            param: *const c_void,
        ) -> Hwnd;
        #[link_name = "DefWindowProcW"]
        fn def_window_proc_w(hwnd: Hwnd, message: u32, wparam: Wparam, lparam: Lparam) -> Lresult;
        #[link_name = "DispatchMessageW"]
        fn dispatch_message_w(message: *const Msg) -> Lresult;
        #[link_name = "GetMessageW"]
        fn get_message_w(message: *mut Msg, hwnd: Hwnd, min_filter: u32, max_filter: u32) -> Bool;
        #[link_name = "RegisterClassW"]
        fn register_class_w(window_class: *const WndClassW) -> u16;
        #[link_name = "RemoveClipboardFormatListener"]
        fn remove_clipboard_format_listener(hwnd: Hwnd) -> Bool;
        #[link_name = "TranslateMessage"]
        fn translate_message(message: *const Msg) -> Bool;
    }

    static CLIPBOARD_EVENT_SENDER: OnceLock<Mutex<Option<Sender<()>>>> = OnceLock::new();

    pub fn spawn(app_handle: AppHandle) {
        thread::spawn(move || {
            let diagnostics_handle = app_handle.clone();
            if let Err(error) = run_message_watcher(app_handle) {
                log_error(
                    &diagnostics_handle,
                    "clipboard",
                    &format!("failed to start Windows clipboard listener: {error}"),
                );
            }
        });
    }

    fn run_message_watcher(app_handle: AppHandle) -> Result<(), String> {
        let (event_sender, event_receiver) = mpsc::channel::<()>();
        let sender_slot = CLIPBOARD_EVENT_SENDER.get_or_init(|| Mutex::new(None));
        *sender_slot.lock().map_err(|error| error.to_string())? = Some(event_sender);

        let hwnd = create_message_window()?;
        let listener_added = unsafe { add_clipboard_format_listener(hwnd) } != 0;

        if !listener_added {
            clear_event_sender();
            return Err("AddClipboardFormatListener failed".to_string());
        }

        let mut last_signature = load_settings(&app_handle)
            .map(|settings| read_clipboard_signature(&settings.enabled_history_types))
            .unwrap_or_default();
        let mut message = Msg::default();

        loop {
            let result = unsafe { get_message_w(&mut message, 0, 0, 0) };

            if result <= 0 {
                break;
            }

            unsafe {
                translate_message(&message);
                dispatch_message_w(&message);
            }

            // window_proc 只负责把系统事件转成 channel 信号；实际读取剪贴板放在消息循环里做。
            while event_receiver.try_recv().is_ok() {
                if let Ok(settings) = load_settings(&app_handle) {
                    if let Some(snapshot) = read_clipboard_snapshot(&settings.enabled_history_types)
                    {
                        process_clipboard_snapshot(&app_handle, &mut last_signature, snapshot);
                    }
                }
            }
        }

        unsafe {
            remove_clipboard_format_listener(hwnd);
        }
        clear_event_sender();

        Ok(())
    }

    fn create_message_window() -> Result<Hwnd, String> {
        let class_name = wide_null("mclip_clipboard_listener");
        let window_name = wide_null("");
        let instance = unsafe { get_module_handle_w(ptr::null()) };

        let window_class = WndClassW {
            lpfn_wnd_proc: Some(window_proc),
            h_instance: instance,
            lpsz_class_name: class_name.as_ptr(),
            ..WndClassW {
                style: 0,
                lpfn_wnd_proc: None,
                cb_cls_extra: 0,
                cb_wnd_extra: 0,
                h_instance: 0,
                h_icon: 0,
                h_cursor: 0,
                hbr_background: 0,
                lpsz_menu_name: ptr::null(),
                lpsz_class_name: ptr::null(),
            }
        };

        let atom = unsafe { register_class_w(&window_class) };

        if atom == 0 {
            return Err("RegisterClassW failed".to_string());
        }

        let hwnd = unsafe {
            create_window_ex_w(
                0,
                class_name.as_ptr(),
                window_name.as_ptr(),
                0,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                0,
                instance,
                ptr::null(),
            )
        };

        if hwnd == 0 {
            Err("CreateWindowExW failed".to_string())
        } else {
            Ok(hwnd)
        }
    }

    fn clear_event_sender() {
        if let Some(sender_slot) = CLIPBOARD_EVENT_SENDER.get() {
            if let Ok(mut sender) = sender_slot.lock() {
                *sender = None;
            }
        }
    }

    unsafe extern "system" fn window_proc(
        hwnd: Hwnd,
        message: u32,
        wparam: Wparam,
        lparam: Lparam,
    ) -> Lresult {
        if message == WM_CLIPBOARDUPDATE {
            if let Some(sender_slot) = CLIPBOARD_EVENT_SENDER.get() {
                if let Ok(sender_guard) = sender_slot.lock() {
                    if let Some(sender) = sender_guard.as_ref() {
                        let _ = sender.send(());
                    }
                }
            }

            return 0;
        }

        unsafe { def_window_proc_w(hwnd, message, wparam, lparam) }
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }
}

#[cfg(target_os = "windows")]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    windows_clipboard_watcher::spawn(app_handle);
}

#[cfg(test)]
mod tests {
    use crate::settings::HistoryTypes;

    use super::{
        clipboard_file_list_paths, clipboard_snapshot_from_candidates, macos_auto_paste_access_result,
        normalize_suspicious_clipboard_alpha, read_snapshot_after_change_token_update,
        text_to_history_item, ClipboardSnapshot,
    };
    use crate::history::{HistoryKind, NewHistoryItem};
    use image::RgbaImage;

    fn all_types() -> HistoryTypes {
        HistoryTypes {
            text: true,
            image: true,
            files: true,
        }
    }

    #[test]
    fn text_to_history_item_returns_text_for_any_string() {
        let item = text_to_history_item("https://example.com".to_string(), &all_types()).unwrap();
        assert_eq!(item.kind(), HistoryKind::Text);
    }

    #[test]
    fn text_to_history_item_respects_disabled_text_type() {
        let item = text_to_history_item(
            "plain text".to_string(),
            &HistoryTypes {
                text: false,
                image: true,
                files: true,
            },
        );

        assert!(item.is_none());
    }

    #[test]
    fn text_to_history_item_ignores_diagnostic_reports() {
        let item = text_to_history_item(
            "mclip diagnostics\n\nApp version: 0.1.0".to_string(),
            &all_types(),
        );

        assert!(item.is_none());
    }

    #[test]
    fn text_to_history_item_converts_file_url_to_files() {
        let item = text_to_history_item(
            "file:///Users/watson/Documents/report.pdf".to_string(),
            &all_types(),
        )
        .unwrap();

        match item {
            NewHistoryItem::Files(file_paths) => {
                assert_eq!(
                    file_paths,
                    vec!["/Users/watson/Documents/report.pdf".to_string()]
                );
            }
            _ => panic!("expected file URL text to become files history"),
        }
    }

    #[test]
    fn text_to_history_item_converts_file_url_lines_to_files() {
        let item = text_to_history_item(
            "file:///Users/watson/Documents/report%202026.pdf\nfile:///Users/watson/Desktop/icon.png"
                .to_string(),
            &all_types(),
        )
        .unwrap();

        match item {
            NewHistoryItem::Files(file_paths) => {
                assert_eq!(
                    file_paths,
                    vec![
                        "/Users/watson/Documents/report 2026.pdf".to_string(),
                        "/Users/watson/Desktop/icon.png".to_string(),
                    ]
                );
            }
            _ => panic!("expected file URL text to become files history"),
        }
    }

    #[test]
    fn text_to_history_item_converts_file_url_when_text_type_is_disabled() {
        let item = text_to_history_item(
            "file:///Users/watson/Documents/report.pdf".to_string(),
            &HistoryTypes {
                text: false,
                image: true,
                files: true,
            },
        )
        .unwrap();

        assert_eq!(item.kind(), HistoryKind::Files);
    }

    #[test]
    fn clipboard_file_list_paths_normalizes_file_urls() {
        let paths = clipboard_file_list_paths(vec![
            "file:///Users/watson/Documents/report%202026.pdf".to_string(),
            "/Users/watson/Desktop/icon.png".to_string(),
        ]);

        assert_eq!(
            paths,
            vec![
                std::path::PathBuf::from("/Users/watson/Documents/report 2026.pdf"),
                std::path::PathBuf::from("/Users/watson/Desktop/icon.png"),
            ]
        );
    }

    #[test]
    fn macos_auto_paste_access_returns_error_when_event_synthesis_is_denied() {
        let error = macos_auto_paste_access_result(false, false).unwrap_err();

        assert!(error.contains("macOS Accessibility permission"));
    }

    #[test]
    fn clipboard_snapshot_prefers_file_list_over_image_data() {
        let snapshot = clipboard_snapshot_from_candidates(
            Some(NewHistoryItem::Files(vec!["/tmp/note.txt".to_string()])),
            Some(NewHistoryItem::Image {
                png_bytes: vec![1, 2, 3],
                width: 1,
                height: 1,
                content_hash: "icon".to_string(),
            }),
            None,
        )
        .unwrap();

        assert_eq!(snapshot.item.kind(), HistoryKind::Files);
    }

    #[test]
    fn unchanged_clipboard_change_token_skips_snapshot_read() {
        let mut last_change_token = 7;
        let mut read_count = 0;
        let snapshot =
            read_snapshot_after_change_token_update(&mut last_change_token, Some(7), || {
                read_count += 1;
                Some(ClipboardSnapshot {
                    signature: "new-text".to_string(),
                    item: NewHistoryItem::Text("hello".to_string()),
                })
            });

        assert!(snapshot.is_none());
        assert_eq!(read_count, 0);
        assert_eq!(last_change_token, 7);
    }

    #[test]
    fn changed_clipboard_change_token_reads_snapshot_once() {
        let mut last_change_token = 7;
        let mut read_count = 0;
        let snapshot =
            read_snapshot_after_change_token_update(&mut last_change_token, Some(8), || {
                read_count += 1;
                Some(ClipboardSnapshot {
                    signature: "new-text".to_string(),
                    item: NewHistoryItem::Text("hello".to_string()),
                })
            })
            .unwrap();

        assert_eq!(snapshot.signature, "new-text");
        assert_eq!(read_count, 1);
        assert_eq!(last_change_token, 8);
    }

    #[test]
    fn unavailable_clipboard_change_token_falls_back_to_snapshot_read() {
        let mut last_change_token = 7;
        let mut read_count = 0;
        let snapshot =
            read_snapshot_after_change_token_update(&mut last_change_token, None, || {
                read_count += 1;
                Some(ClipboardSnapshot {
                    signature: "fallback-text".to_string(),
                    item: NewHistoryItem::Text("hello".to_string()),
                })
            })
            .unwrap();

        assert_eq!(snapshot.signature, "fallback-text");
        assert_eq!(read_count, 1);
        assert_eq!(last_change_token, 7);
    }

    #[test]
    fn normalize_suspicious_clipboard_alpha_makes_hidden_rgb_opaque() {
        let mut image = RgbaImage::from_raw(
            2,
            2,
            vec![
                240, 10, 10, 0, 20, 220, 20, 0, 30, 30, 210, 0, 200, 200, 200, 0,
            ],
        )
        .unwrap();

        assert!(normalize_suspicious_clipboard_alpha(&mut image));
        assert_eq!(
            image.into_raw(),
            vec![240, 10, 10, 255, 20, 220, 20, 255, 30, 30, 210, 255, 200, 200, 200, 255,]
        );
    }

    #[test]
    fn normalize_suspicious_clipboard_alpha_leaves_empty_transparency_alone() {
        let mut image = RgbaImage::from_raw(2, 2, vec![0; 16]).unwrap();

        assert!(!normalize_suspicious_clipboard_alpha(&mut image));
        assert_eq!(image.into_raw(), vec![0; 16]);
    }

    #[test]
    fn normalize_suspicious_clipboard_alpha_preserves_partial_transparency() {
        let mut image = RgbaImage::from_raw(
            2,
            2,
            vec![
                240, 10, 10, 0, 20, 220, 20, 0, 30, 30, 210, 0, 200, 200, 200, 128,
            ],
        )
        .unwrap();
        let original = image.clone().into_raw();

        assert!(!normalize_suspicious_clipboard_alpha(&mut image));
        assert_eq!(image.into_raw(), original);
    }
}
