//! 剪贴板读写与监听。
//! Windows 使用系统剪贴板事件；其它平台保留轻量轮询，并且每次读取都重新打开剪贴板以降低句柄失效风险。

use std::borrow::Cow;
use std::path::PathBuf;

use arboard::{Clipboard, ImageData};
use base64::prelude::*;
use image::imageops::{self, FilterType};
use image::RgbaImage;
use image::{codecs::png::PngEncoder, ColorType, ImageEncoder};
#[cfg(not(target_os = "windows"))]
use std::thread;
#[cfg(not(target_os = "windows"))]
use std::time::Duration;
use tauri::AppHandle;

use crate::history::{
    emit_history_updated, find_history_item, hash_hex, process_new_history_item, HistoryEntry,
    NewHistoryItem,
};
#[cfg(not(target_os = "windows"))]
use crate::settings::load_settings;
use crate::settings::HistoryTypes;

#[cfg(not(target_os = "windows"))]
const CLIPBOARD_POLL_INTERVAL_MS: u64 = 500;
const MAX_IMAGE_DIMENSION: u32 = 1200;

#[tauri::command]
pub fn copy_history_item(app_handle: AppHandle, id: String) -> Result<(), String> {
    let Some(history_item) = find_history_item(&app_handle, &id)? else {
        return Err("history item not found".to_string());
    };

    write_history_item_to_clipboard(history_item)
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
                eprintln!("failed to emit history update: {error}");
            }
        }
        Ok(None) => {}
        Err(error) => {
            eprintln!("failed to process clipboard history: {error}");
        }
    }
}

fn write_history_item_to_clipboard(history_item: HistoryEntry) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;

    match history_item {
        HistoryEntry::Text { text, .. } => {
            clipboard.set_text(text).map_err(|error| error.to_string())
        }
        HistoryEntry::Files { file_paths, .. } => {
            let paths: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();
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

struct ClipboardSnapshot {
    signature: String,
    item: NewHistoryItem,
}

fn read_clipboard_snapshot(enabled_types: &HistoryTypes) -> Option<ClipboardSnapshot> {
    if enabled_types.image {
        if let Ok(item) = read_clipboard_image() {
            return Some(ClipboardSnapshot {
                signature: item.dedupe_key(),
                item,
            });
        }
    }

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
                return Some(ClipboardSnapshot {
                    signature: item.dedupe_key(),
                    item,
                });
            }
        }
    }

    if enabled_types.text {
        if let Ok(text) = read_clipboard_text() {
            if let Some(item) = text_to_history_item(text, enabled_types) {
                return Some(ClipboardSnapshot {
                    signature: item.dedupe_key(),
                    item,
                });
            }
        }
    }

    None
}

fn read_clipboard_signature(enabled_types: &HistoryTypes) -> String {
    read_clipboard_snapshot(enabled_types)
        .map(|snapshot| snapshot.signature)
        .unwrap_or_default()
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

fn read_clipboard_image() -> Result<NewHistoryItem, String> {
    let clipboard_image = Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_image())
        .map_err(|error| error.to_string())?;

    let rgba = RgbaImage::from_raw(
        clipboard_image.width as u32,
        clipboard_image.height as u32,
        clipboard_image.bytes.as_ref().to_vec(),
    )
    .ok_or_else(|| "failed to create image from raw clipboard pixels".to_string())?;

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

    if enabled_types.text {
        Some(NewHistoryItem::Text(text))
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_signature = load_settings(&app_handle)
            .map(|settings| read_clipboard_signature(&settings.enabled_history_types))
            .unwrap_or_default();

        loop {
            // macOS 当前仍采用轮询。每轮独立读取，避免长时间持有 Clipboard 导致后续读取不稳定。
            if let Ok(settings) = load_settings(&app_handle) {
                if let Some(snapshot) = read_clipboard_snapshot(&settings.enabled_history_types) {
                    process_clipboard_snapshot(&app_handle, &mut last_signature, snapshot);
                }
            }

            thread::sleep(Duration::from_millis(CLIPBOARD_POLL_INTERVAL_MS));
        }
    });
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
            if let Err(error) = run_message_watcher(app_handle) {
                eprintln!("failed to start Windows clipboard listener: {error}");
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

    use super::text_to_history_item;
    use crate::history::{HistoryKind, NewHistoryItem};

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
}
