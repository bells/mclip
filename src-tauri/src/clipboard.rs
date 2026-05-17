//! 剪贴板读写与监听。
//! Windows 使用系统剪贴板事件；其它平台保留轻量轮询，并且每次读取都重新打开剪贴板以降低句柄失效风险。

use arboard::Clipboard;
#[cfg(not(target_os = "windows"))]
use std::thread;
#[cfg(not(target_os = "windows"))]
use std::time::Duration;
use tauri::AppHandle;

use crate::history::{emit_history_updated, process_new_history_item};

#[cfg(not(target_os = "windows"))]
const CLIPBOARD_POLL_INTERVAL_MS: u64 = 500;

#[tauri::command]
pub fn copy_to_clipboard(content: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(content)
        .map_err(|error| error.to_string())
}

fn read_clipboard_text() -> Result<String, String> {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_text())
        .map_err(|error| error.to_string())
}

pub fn spawn_clipboard_watcher(app_handle: AppHandle) {
    spawn_platform_clipboard_watcher(app_handle);
}

// 统一处理平台监听得到的新文本：去重、写入历史、通知前端刷新。
fn process_clipboard_text(
    app_handle: &AppHandle,
    last_content: &mut String,
    current_content: String,
) {
    if current_content.is_empty() || current_content == *last_content {
        return;
    }

    *last_content = current_content.clone();

    match process_new_history_item(app_handle, &current_content) {
        Ok(updated_history) => {
            if let Err(error) = emit_history_updated(app_handle, &updated_history) {
                eprintln!("failed to emit history update: {error}");
            }
        }
        Err(error) => {
            eprintln!("failed to process clipboard history: {error}");
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_content = read_clipboard_text().unwrap_or_default();

        loop {
            // macOS 当前仍采用轮询。每轮独立读取，避免长时间持有 Clipboard 导致后续读取不稳定。
            if let Ok(current_content) = read_clipboard_text() {
                process_clipboard_text(&app_handle, &mut last_content, current_content);
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

    use super::{process_clipboard_text, read_clipboard_text};

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

        let mut last_content = read_clipboard_text().unwrap_or_default();
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
                if let Ok(current_content) = read_clipboard_text() {
                    process_clipboard_text(&app_handle, &mut last_content, current_content);
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
        let instance = unsafe { get_module_handle_w(ptr::null()) };

        let window_class = WndClassW {
            style: 0,
            lpfn_wnd_proc: Some(window_proc),
            cb_cls_extra: 0,
            cb_wnd_extra: 0,
            h_instance: instance,
            h_icon: 0,
            h_cursor: 0,
            hbr_background: 0,
            lpsz_menu_name: ptr::null(),
            lpsz_class_name: class_name.as_ptr(),
        };

        let atom = unsafe { register_class_w(&window_class) };
        if atom == 0 {
            return Err("RegisterClassW failed".to_string());
        }

        let hwnd = unsafe {
            create_window_ex_w(
                0,
                class_name.as_ptr(),
                class_name.as_ptr(),
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

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe extern "system" fn window_proc(
        hwnd: Hwnd,
        message: u32,
        wparam: Wparam,
        lparam: Lparam,
    ) -> Lresult {
        if message == WM_CLIPBOARDUPDATE {
            // Win32 回调保持极简，避免在回调里做可能阻塞的剪贴板读取。
            if let Some(sender_slot) = CLIPBOARD_EVENT_SENDER.get() {
                if let Ok(sender) = sender_slot.lock() {
                    if let Some(sender) = sender.as_ref() {
                        let _ = sender.send(());
                    }
                }
            }

            return 0;
        }

        unsafe { def_window_proc_w(hwnd, message, wparam, lparam) }
    }
}

#[cfg(target_os = "windows")]
fn spawn_platform_clipboard_watcher(app_handle: AppHandle) {
    windows_clipboard_watcher::spawn(app_handle);
}
