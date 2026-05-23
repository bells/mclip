//! Best-effort detection of the app that owned focus when clipboard text changed.

#[cfg(target_os = "macos")]
use std::ffi::{c_char, c_void, CStr};

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;
#[cfg(target_os = "windows")]
use std::path::Path;

pub fn current_source_app_name() -> Option<String> {
    platform_source_app_name().and_then(|name| {
        let trimmed = name.trim();

        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[cfg(target_os = "macos")]
fn platform_source_app_name() -> Option<String> {
    let workspace_class = objc_class(b"NSWorkspace\0")?;
    let shared_workspace =
        unsafe { objc_msg_send_id(workspace_class, selector(b"sharedWorkspace\0")) };
    let frontmost_application =
        unsafe { objc_msg_send_id(shared_workspace, selector(b"frontmostApplication\0")) };
    let localized_name =
        unsafe { objc_msg_send_id(frontmost_application, selector(b"localizedName\0")) };
    let utf8_name =
        unsafe { objc_msg_send_id(localized_name, selector(b"UTF8String\0")) } as *const c_char;

    if utf8_name.is_null() {
        return None;
    }

    Some(
        unsafe { CStr::from_ptr(utf8_name) }
            .to_string_lossy()
            .to_string(),
    )
}

#[cfg(target_os = "windows")]
fn platform_source_app_name() -> Option<String> {
    let hwnd = unsafe { get_foreground_window() };

    if hwnd == 0 {
        return None;
    }

    let mut process_id = 0;
    unsafe {
        get_window_thread_process_id(hwnd, &mut process_id);
    }

    if process_id == 0 {
        return None;
    }

    let process = unsafe { open_process(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };

    if process == 0 {
        return None;
    }

    let process_name = query_process_image_name(process);
    unsafe {
        close_handle(process);
    }

    process_name
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_source_app_name() -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
fn objc_class(name: &'static [u8]) -> Option<ObjcId> {
    let class = unsafe { objc_get_class(name.as_ptr().cast()) };

    if class.is_null() {
        None
    } else {
        Some(class)
    }
}

#[cfg(target_os = "macos")]
fn selector(name: &'static [u8]) -> ObjcSel {
    unsafe { sel_register_name(name.as_ptr().cast()) }
}

#[cfg(target_os = "macos")]
type ObjcId = *mut c_void;
#[cfg(target_os = "macos")]
type ObjcSel = *mut c_void;

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

#[cfg(target_os = "macos")]
#[link(name = "objc")]
unsafe extern "C" {
    #[link_name = "objc_getClass"]
    fn objc_get_class(name: *const c_char) -> ObjcId;
    #[link_name = "sel_registerName"]
    fn sel_register_name(name: *const c_char) -> ObjcSel;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_id(receiver: ObjcId, selector: ObjcSel) -> ObjcId;
}

#[cfg(target_os = "windows")]
fn query_process_image_name(process: Handle) -> Option<String> {
    let mut buffer = vec![0_u16; 1024];
    let mut size = buffer.len() as u32;
    let success =
        unsafe { query_full_process_image_name_w(process, 0, buffer.as_mut_ptr(), &mut size) } != 0;

    if !success || size == 0 {
        return None;
    }

    buffer.truncate(size as usize);
    let path = OsString::from_wide(&buffer).to_string_lossy().to_string();

    Path::new(&path)
        .file_stem()
        .map(|name| name.to_string_lossy().to_string())
}

#[cfg(target_os = "windows")]
type Bool = i32;
#[cfg(target_os = "windows")]
type Dword = u32;
#[cfg(target_os = "windows")]
type Handle = isize;
#[cfg(target_os = "windows")]
type Hwnd = isize;

#[cfg(target_os = "windows")]
const PROCESS_QUERY_LIMITED_INFORMATION: Dword = 0x1000;

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    #[link_name = "CloseHandle"]
    fn close_handle(object: Handle) -> Bool;
    #[link_name = "OpenProcess"]
    fn open_process(desired_access: Dword, inherit_handle: Bool, process_id: Dword) -> Handle;
    #[link_name = "QueryFullProcessImageNameW"]
    fn query_full_process_image_name_w(
        process: Handle,
        flags: Dword,
        exe_name: *mut u16,
        size: *mut Dword,
    ) -> Bool;
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
unsafe extern "system" {
    #[link_name = "GetForegroundWindow"]
    fn get_foreground_window() -> Hwnd;
    #[link_name = "GetWindowThreadProcessId"]
    fn get_window_thread_process_id(hwnd: Hwnd, process_id: *mut Dword) -> Dword;
}
