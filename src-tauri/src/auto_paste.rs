use std::sync::{mpsc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AutoPasteTarget {
    process_id: i32,
}

#[derive(Default)]
pub(crate) struct AutoPasteTargetState {
    target: Mutex<Option<AutoPasteTarget>>,
}

impl AutoPasteTargetState {
    fn remember(&self, target: Option<AutoPasteTarget>) {
        let Some(target) = target else {
            return;
        };

        if let Ok(mut remembered_target) = self.target.lock() {
            *remembered_target = Some(target);
        }
    }

    pub(crate) fn take(&self) -> Option<AutoPasteTarget> {
        self.target.lock().ok().and_then(|mut target| target.take())
    }
}

pub(crate) fn remember_current_paste_target(app_handle: &AppHandle) {
    let Some(state) = app_handle.try_state::<AutoPasteTargetState>() else {
        return;
    };

    state.remember(current_paste_target());
}

pub(crate) fn activate_paste_target(target: Option<AutoPasteTarget>) -> Result<(), String> {
    let Some(target) = target else {
        return Ok(());
    };

    platform_activate_paste_target(target)
}

pub(crate) fn activate_paste_target_on_main_thread(
    app_handle: &AppHandle,
    target: Option<AutoPasteTarget>,
) -> Result<(), String> {
    if target.is_none() {
        return Ok(());
    }

    let (sender, receiver) = mpsc::channel();

    app_handle
        .run_on_main_thread(move || {
            let _ = sender.send(activate_paste_target(target));
        })
        .map_err(|error| error.to_string())?;

    receiver
        .recv_timeout(Duration::from_millis(500))
        .map_err(|error| error.to_string())?
}

fn choose_paste_target(
    frontmost_process_id: i32,
    current_process_id: i32,
) -> Option<AutoPasteTarget> {
    if frontmost_process_id <= 0 || frontmost_process_id == current_process_id {
        return None;
    }

    Some(AutoPasteTarget {
        process_id: frontmost_process_id,
    })
}

#[cfg(target_os = "macos")]
fn current_paste_target() -> Option<AutoPasteTarget> {
    let workspace_class = objc_class(b"NSWorkspace\0")?;
    let shared_workspace =
        unsafe { objc_msg_send_id(workspace_class, selector(b"sharedWorkspace\0")) };
    let frontmost_application =
        unsafe { objc_msg_send_id(shared_workspace, selector(b"frontmostApplication\0")) };
    let current_application = current_application()?;

    if frontmost_application.is_null() {
        return None;
    }

    let frontmost_process_id =
        unsafe { objc_msg_send_i32(frontmost_application, selector(b"processIdentifier\0")) };
    let current_process_id =
        unsafe { objc_msg_send_i32(current_application, selector(b"processIdentifier\0")) };

    choose_paste_target(frontmost_process_id, current_process_id)
}

#[cfg(not(target_os = "macos"))]
fn current_paste_target() -> Option<AutoPasteTarget> {
    None
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MacosActivationReceiverKind {
    SharedApplication,
    RunningApplication,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MacosActivationReceiverPlan {
    yielding_receiver: MacosActivationReceiverKind,
    target_receiver: MacosActivationReceiverKind,
}

#[cfg(target_os = "macos")]
fn macos_activation_receiver_plan() -> MacosActivationReceiverPlan {
    MacosActivationReceiverPlan {
        yielding_receiver: MacosActivationReceiverKind::SharedApplication,
        target_receiver: MacosActivationReceiverKind::RunningApplication,
    }
}

#[cfg(target_os = "macos")]
fn platform_activate_paste_target(target: AutoPasteTarget) -> Result<(), String> {
    const NS_APPLICATION_ACTIVATE_ALL_WINDOWS: usize = 1 << 0;

    let activation_plan = macos_activation_receiver_plan();
    let application = shared_application()
        .ok_or_else(|| "failed to read shared macOS application".to_string())?;
    let target_application = running_application_with_process_id(target.process_id)
        .ok_or_else(|| "failed to find remembered macOS paste target".to_string())?;

    if activation_plan.yielding_receiver == MacosActivationReceiverKind::SharedApplication {
        unsafe {
            objc_msg_send_void_id(
                application,
                selector(b"yieldActivationToApplication:\0"),
                target_application,
            );
        }
    }

    let activated =
        if activation_plan.target_receiver == MacosActivationReceiverKind::RunningApplication {
            unsafe {
                objc_msg_send_bool_usize(
                    target_application,
                    selector(b"activateWithOptions:\0"),
                    NS_APPLICATION_ACTIVATE_ALL_WINDOWS,
                )
            }
        } else {
            0
        };

    if activated != 0 {
        Ok(())
    } else {
        Err("macOS refused to activate remembered paste target".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
fn platform_activate_paste_target(_target: AutoPasteTarget) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn shared_application() -> Option<ObjcId> {
    let application_class = objc_class(b"NSApplication\0")?;
    let application =
        unsafe { objc_msg_send_id(application_class, selector(b"sharedApplication\0")) };

    if application.is_null() {
        None
    } else {
        Some(application)
    }
}

#[cfg(target_os = "macos")]
fn current_application() -> Option<ObjcId> {
    let application_class = objc_class(b"NSRunningApplication\0")?;
    let application =
        unsafe { objc_msg_send_id(application_class, selector(b"currentApplication\0")) };

    if application.is_null() {
        None
    } else {
        Some(application)
    }
}

#[cfg(target_os = "macos")]
fn running_application_with_process_id(process_id: i32) -> Option<ObjcId> {
    let application_class = objc_class(b"NSRunningApplication\0")?;
    let application = unsafe {
        objc_msg_send_id_i32(
            application_class,
            selector(b"runningApplicationWithProcessIdentifier:\0"),
            process_id,
        )
    };

    if application.is_null() {
        None
    } else {
        Some(application)
    }
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
type ObjcBool = std::ffi::c_schar;
#[cfg(target_os = "macos")]
type ObjcId = *mut std::ffi::c_void;
#[cfg(target_os = "macos")]
type ObjcSel = *mut std::ffi::c_void;

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

#[cfg(target_os = "macos")]
#[link(name = "objc")]
#[allow(clashing_extern_declarations)]
unsafe extern "C" {
    #[link_name = "objc_getClass"]
    fn objc_get_class(name: *const std::ffi::c_char) -> ObjcId;
    #[link_name = "sel_registerName"]
    fn sel_register_name(name: *const std::ffi::c_char) -> ObjcSel;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_id(receiver: ObjcId, selector: ObjcSel) -> ObjcId;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_i32(receiver: ObjcId, selector: ObjcSel) -> i32;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_id_i32(receiver: ObjcId, selector: ObjcSel, value: i32) -> ObjcId;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_bool_usize(receiver: ObjcId, selector: ObjcSel, value: usize) -> ObjcBool;
    #[link_name = "objc_msgSend"]
    fn objc_msg_send_void_id(receiver: ObjcId, selector: ObjcSel, value: ObjcId);
}

#[cfg(test)]
mod tests {
    use super::{choose_paste_target, AutoPasteTarget, AutoPasteTargetState};
    #[cfg(target_os = "macos")]
    use super::{macos_activation_receiver_plan, MacosActivationReceiverKind};

    #[test]
    fn paste_target_ignores_the_current_app() {
        assert_eq!(choose_paste_target(42, 42), None);
    }

    #[test]
    fn paste_target_ignores_invalid_process_ids() {
        assert_eq!(choose_paste_target(-1, 42), None);
        assert_eq!(choose_paste_target(0, 42), None);
    }

    #[test]
    fn paste_target_state_remembers_and_drains_last_external_app() {
        let state = AutoPasteTargetState::default();

        state.remember(Some(AutoPasteTarget { process_id: 100 }));
        state.remember(None);

        assert_eq!(state.take(), Some(AutoPasteTarget { process_id: 100 }));
        assert_eq!(state.take(), None);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn macos_activation_yields_from_shared_application_to_running_application() {
        let plan = macos_activation_receiver_plan();

        assert_eq!(
            plan.yielding_receiver,
            MacosActivationReceiverKind::SharedApplication,
        );
        assert_eq!(
            plan.target_receiver,
            MacosActivationReceiverKind::RunningApplication,
        );
    }
}
