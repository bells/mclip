//! Best-effort foreground application identity at the clipboard-change boundary.

use serde::Serialize;

use crate::settings::normalize_source_app_identifier;

#[cfg(target_os = "macos")]
use std::ffi::{c_char, c_void, CStr};

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;
#[cfg(target_os = "windows")]
use std::path::Path;

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SourceApplicationIdentity {
    pub id: String,
    pub display_name: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceAppDetectionCapability {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAppDetectionStatus {
    pub capability: SourceAppDetectionCapability,
    pub reason_code: &'static str,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum SourceIdentityLookupError {
    Unavailable,
    LookupFailed,
}

impl SourceIdentityLookupError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::Unavailable => "sourceIdentityUnavailable",
            Self::LookupFailed => "sourceIdentityLookupFailed",
        }
    }
}

#[tauri::command]
pub fn get_source_app_detection_status() -> SourceAppDetectionStatus {
    platform_detection_status()
}

pub fn current_source_app_identity(
) -> Result<Option<SourceApplicationIdentity>, SourceIdentityLookupError> {
    platform_source_app_identity()
}

fn identity(id: String, display_name: String) -> Option<SourceApplicationIdentity> {
    let id = normalize_source_app_identifier(&id)?;
    let display_name = display_name.trim();
    if display_name.is_empty() {
        return None;
    }

    Some(SourceApplicationIdentity {
        id,
        display_name: display_name.to_string(),
    })
}

#[cfg(target_os = "macos")]
fn platform_detection_status() -> SourceAppDetectionStatus {
    SourceAppDetectionStatus {
        capability: SourceAppDetectionCapability::Available,
        reason_code: "macOsBundleIdentifier",
    }
}

#[cfg(target_os = "macos")]
fn platform_source_app_identity(
) -> Result<Option<SourceApplicationIdentity>, SourceIdentityLookupError> {
    let workspace_class =
        objc_class(b"NSWorkspace\0").ok_or(SourceIdentityLookupError::LookupFailed)?;
    let shared_workspace =
        unsafe { objc_msg_send_id(workspace_class, selector(b"sharedWorkspace\0")) };
    let frontmost_application =
        unsafe { objc_msg_send_id(shared_workspace, selector(b"frontmostApplication\0")) };
    if frontmost_application.is_null() {
        return Ok(None);
    }

    let bundle_identifier = objc_string(frontmost_application, b"bundleIdentifier\0");
    let display_name = objc_string(frontmost_application, b"localizedName\0");

    Ok(match (bundle_identifier, display_name) {
        (Some(bundle_identifier), Some(display_name)) => {
            identity(format!("macos:{bundle_identifier}"), display_name)
        }
        _ => None,
    })
}

#[cfg(target_os = "macos")]
fn objc_string(receiver: ObjcId, selector_name: &'static [u8]) -> Option<String> {
    let value = unsafe { objc_msg_send_id(receiver, selector(selector_name)) };
    if value.is_null() {
        return None;
    }
    let utf8 = unsafe { objc_msg_send_id(value, selector(b"UTF8String\0")) } as *const c_char;
    if utf8.is_null() {
        return None;
    }

    Some(
        unsafe { CStr::from_ptr(utf8) }
            .to_string_lossy()
            .into_owned(),
    )
}

#[cfg(target_os = "windows")]
fn platform_detection_status() -> SourceAppDetectionStatus {
    SourceAppDetectionStatus {
        capability: SourceAppDetectionCapability::Available,
        reason_code: "windowsExecutableIdentity",
    }
}

#[cfg(target_os = "windows")]
fn platform_source_app_identity(
) -> Result<Option<SourceApplicationIdentity>, SourceIdentityLookupError> {
    let hwnd = unsafe { get_foreground_window() };
    if hwnd == 0 {
        return Ok(None);
    }

    let mut process_id = 0;
    unsafe {
        get_window_thread_process_id(hwnd, &mut process_id);
    }
    if process_id == 0 {
        return Ok(None);
    }

    let process = unsafe { open_process(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
    if process == 0 {
        return Err(SourceIdentityLookupError::LookupFailed);
    }

    let process_path = query_process_image_path(process);
    unsafe {
        close_handle(process);
    }

    Ok(process_path.and_then(|path| {
        let file_name = Path::new(&path).file_name()?.to_string_lossy().into_owned();
        let display_name = Path::new(&file_name)
            .file_stem()
            .map(|value| value.to_string_lossy().into_owned())?;
        identity(format!("windows:{file_name}"), display_name)
    }))
}

#[cfg(target_os = "windows")]
fn query_process_image_path(process: Handle) -> Option<String> {
    let mut buffer = vec![0_u16; 1024];
    let mut size = buffer.len() as u32;
    let success =
        unsafe { query_full_process_image_name_w(process, 0, buffer.as_mut_ptr(), &mut size) } != 0;
    if !success || size == 0 {
        return None;
    }

    buffer.truncate(size as usize);
    Some(OsString::from_wide(&buffer).to_string_lossy().into_owned())
}

#[cfg(target_os = "linux")]
fn is_pure_wayland_session() -> bool {
    std::env::var_os("WAYLAND_DISPLAY").is_some() && std::env::var_os("DISPLAY").is_none()
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn linux_detection_status_from_session(
    has_wayland_display: bool,
    has_x11_display: bool,
) -> SourceAppDetectionStatus {
    if has_wayland_display && !has_x11_display {
        SourceAppDetectionStatus {
            capability: SourceAppDetectionCapability::Unavailable,
            reason_code: "pureWaylandSourceIdentityUnavailable",
        }
    } else if has_x11_display {
        SourceAppDetectionStatus {
            capability: SourceAppDetectionCapability::Available,
            reason_code: "x11WmClassIdentity",
        }
    } else {
        SourceAppDetectionStatus {
            capability: SourceAppDetectionCapability::Unavailable,
            reason_code: "displayServerUnavailable",
        }
    }
}

#[cfg(target_os = "linux")]
fn platform_detection_status() -> SourceAppDetectionStatus {
    linux_detection_status_from_session(
        std::env::var_os("WAYLAND_DISPLAY").is_some(),
        std::env::var_os("DISPLAY").is_some(),
    )
}

#[cfg(target_os = "linux")]
fn platform_source_app_identity(
) -> Result<Option<SourceApplicationIdentity>, SourceIdentityLookupError> {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::{AtomEnum, ConnectionExt};

    if is_pure_wayland_session() || std::env::var_os("DISPLAY").is_none() {
        return Err(SourceIdentityLookupError::Unavailable);
    }

    let (connection, screen_index) =
        x11rb::connect(None).map_err(|_| SourceIdentityLookupError::LookupFailed)?;
    let root = connection.setup().roots[screen_index].root;
    let active_window_atom = connection
        .intern_atom(false, b"_NET_ACTIVE_WINDOW")
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .reply()
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .atom;
    let active_window = connection
        .get_property(false, root, active_window_atom, AtomEnum::WINDOW, 0, 1)
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .reply()
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .value32()
        .and_then(|mut values| values.next());
    let Some(active_window) = active_window else {
        return Ok(None);
    };

    let wm_class = connection
        .get_property(
            false,
            active_window,
            AtomEnum::WM_CLASS,
            AtomEnum::STRING,
            0,
            256,
        )
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .reply()
        .map_err(|_| SourceIdentityLookupError::LookupFailed)?
        .value;
    let classes = wm_class
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
        .filter_map(|value| std::str::from_utf8(value).ok())
        .collect::<Vec<_>>();
    let Some(stable_class) = classes.last() else {
        return Ok(None);
    };

    Ok(identity(
        format!("x11:{stable_class}"),
        stable_class.to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn platform_detection_status() -> SourceAppDetectionStatus {
    SourceAppDetectionStatus {
        capability: SourceAppDetectionCapability::Unavailable,
        reason_code: "platformSourceIdentityUnavailable",
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn platform_source_app_identity(
) -> Result<Option<SourceApplicationIdentity>, SourceIdentityLookupError> {
    Err(SourceIdentityLookupError::Unavailable)
}

#[cfg(target_os = "macos")]
fn objc_class(name: &'static [u8]) -> Option<ObjcId> {
    let class = unsafe { objc_get_class(name.as_ptr().cast()) };
    (!class.is_null()).then_some(class)
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

#[cfg(test)]
mod tests {
    use super::{
        identity, linux_detection_status_from_session, SourceAppDetectionCapability,
        SourceAppDetectionStatus,
    };

    #[test]
    fn identity_normalizes_stable_id_but_preserves_display_name() {
        let identity = identity(
            " macos:COM.Example.App ".to_string(),
            " Example ".to_string(),
        )
        .expect("identity should normalize");
        assert_eq!(identity.id, "macos:com.example.app");
        assert_eq!(identity.display_name, "Example");
    }

    #[test]
    fn capability_status_serializes_without_application_identity() {
        let status = SourceAppDetectionStatus {
            capability: SourceAppDetectionCapability::Unavailable,
            reason_code: "pureWaylandSourceIdentityUnavailable",
        };
        let json = serde_json::to_value(status).unwrap();
        assert_eq!(json["capability"], "unavailable");
        assert_eq!(json["reasonCode"], "pureWaylandSourceIdentityUnavailable");
        assert_eq!(json.as_object().unwrap().len(), 2);
    }

    #[test]
    fn linux_session_status_is_honest_for_x11_and_pure_wayland() {
        let x11 = linux_detection_status_from_session(false, true);
        assert_eq!(x11.capability, SourceAppDetectionCapability::Available);
        assert_eq!(x11.reason_code, "x11WmClassIdentity");

        let wayland = linux_detection_status_from_session(true, false);
        assert_eq!(
            wayland.capability,
            SourceAppDetectionCapability::Unavailable
        );
        assert_eq!(wayland.reason_code, "pureWaylandSourceIdentityUnavailable");
    }
}
