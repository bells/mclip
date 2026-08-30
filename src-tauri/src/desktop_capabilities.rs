//! Typed desktop capability state shared with Preferences.
//!
//! Only stable status and reason codes cross IPC. Runtime diagnostics must not
//! include clipboard content, paths, source application names, or ignored IDs.

use std::sync::{Arc, RwLock};

use serde::Serialize;
use tauri::State;

#[cfg(not(target_os = "linux"))]
use crate::source_app::{get_source_app_detection_status, SourceAppDetectionCapability};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopCapabilityStatus {
    Available,
    Degraded,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[allow(dead_code)]
pub enum DesktopSessionKind {
    #[serde(rename = "macOs")]
    MacOs,
    #[serde(rename = "windows")]
    Windows,
    #[serde(rename = "x11")]
    X11,
    #[serde(rename = "xWayland")]
    XWayland,
    #[serde(rename = "wayland")]
    Wayland,
    #[serde(rename = "unknown")]
    Unknown,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapability {
    pub status: DesktopCapabilityStatus,
    pub reason_code: String,
}

impl DesktopCapability {
    fn available(reason_code: impl Into<String>) -> Self {
        Self {
            status: DesktopCapabilityStatus::Available,
            reason_code: reason_code.into(),
        }
    }

    fn degraded(reason_code: impl Into<String>) -> Self {
        Self {
            status: DesktopCapabilityStatus::Degraded,
            reason_code: reason_code.into(),
        }
    }

    fn unavailable(reason_code: impl Into<String>) -> Self {
        Self {
            status: DesktopCapabilityStatus::Unavailable,
            reason_code: reason_code.into(),
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilities {
    pub platform: String,
    pub session_kind: DesktopSessionKind,
    pub clipboard_history: DesktopCapability,
    pub clipboard_write: DesktopCapability,
    pub tray_activation: DesktopCapability,
    pub global_shortcut: DesktopCapability,
    pub source_app_detection: DesktopCapability,
    pub launch_at_login: DesktopCapability,
    pub auto_paste: DesktopCapability,
}

#[derive(Clone)]
pub struct DesktopCapabilityState {
    inner: Arc<RwLock<DesktopCapabilities>>,
}

impl Default for DesktopCapabilityState {
    fn default() -> Self {
        Self::detect()
    }
}

impl DesktopCapabilityState {
    pub fn detect() -> Self {
        Self {
            inner: Arc::new(RwLock::new(detect_platform_capabilities())),
        }
    }

    pub fn snapshot(&self) -> DesktopCapabilities {
        self.inner
            .read()
            .map(|capabilities| capabilities.clone())
            .unwrap_or_else(|_| detect_platform_capabilities())
    }

    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    pub fn record_clipboard_ready(&self) {
        if let Ok(mut capabilities) = self.inner.write() {
            let capability = match capabilities.session_kind {
                DesktopSessionKind::X11 => DesktopCapability::available("x11ClipboardReady"),
                DesktopSessionKind::XWayland => {
                    DesktopCapability::degraded("waylandOrXwaylandClipboardReady")
                }
                DesktopSessionKind::Wayland => {
                    DesktopCapability::available("waylandDataControlReady")
                }
                _ => DesktopCapability::available("platformClipboardReady"),
            };
            capabilities.clipboard_history = capability.clone();
            capabilities.clipboard_write = capability;
        }
    }

    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    pub fn record_clipboard_unavailable(&self) {
        if let Ok(mut capabilities) = self.inner.write() {
            let reason_code = match capabilities.session_kind {
                DesktopSessionKind::X11 => "x11ClipboardUnavailable",
                DesktopSessionKind::XWayland => "linuxClipboardBackendsUnavailable",
                DesktopSessionKind::Wayland => "waylandDataControlUnavailable",
                _ => "displayServerUnavailable",
            };
            let capability = DesktopCapability::unavailable(reason_code);
            capabilities.clipboard_history = capability.clone();
            capabilities.clipboard_write = capability;
        }
    }

    pub fn record_tray_result(&self, available: bool) {
        if let Ok(mut capabilities) = self.inner.write() {
            capabilities.tray_activation = if available {
                DesktopCapability::available("trayActivationReady")
            } else {
                DesktopCapability::unavailable("trayActivationUnavailable")
            };
        }
    }

    pub fn record_global_shortcut_result(&self, available: bool) {
        if let Ok(mut capabilities) = self.inner.write() {
            capabilities.global_shortcut = if available {
                DesktopCapability::available("globalShortcutReady")
            } else {
                DesktopCapability::unavailable("globalShortcutRegistrationFailed")
            };
        }
    }

    pub fn has_background_entrypoint(&self) -> bool {
        let capabilities = self.snapshot();
        capabilities.tray_activation.status == DesktopCapabilityStatus::Available
            || capabilities.global_shortcut.status == DesktopCapabilityStatus::Available
    }
}

#[tauri::command]
pub fn get_desktop_capabilities(state: State<'_, DesktopCapabilityState>) -> DesktopCapabilities {
    state.snapshot()
}

#[cfg(not(target_os = "linux"))]
fn source_app_capability() -> DesktopCapability {
    let source_status = get_source_app_detection_status();
    match source_status.capability {
        SourceAppDetectionCapability::Available => {
            DesktopCapability::available(source_status.reason_code)
        }
        SourceAppDetectionCapability::Unavailable => {
            DesktopCapability::unavailable(source_status.reason_code)
        }
    }
}

#[cfg(target_os = "macos")]
fn detect_platform_capabilities() -> DesktopCapabilities {
    DesktopCapabilities {
        platform: "macOs".to_string(),
        session_kind: DesktopSessionKind::MacOs,
        clipboard_history: DesktopCapability::available("macOsClipboardReady"),
        clipboard_write: DesktopCapability::available("macOsClipboardReady"),
        tray_activation: DesktopCapability::available("trayActivationPending"),
        global_shortcut: DesktopCapability::available("globalShortcutPending"),
        source_app_detection: source_app_capability(),
        launch_at_login: DesktopCapability::available("macOsLaunchAgentAvailable"),
        auto_paste: DesktopCapability::degraded("macOsAccessibilityPermissionRequired"),
    }
}

#[cfg(target_os = "windows")]
fn detect_platform_capabilities() -> DesktopCapabilities {
    DesktopCapabilities {
        platform: "windows".to_string(),
        session_kind: DesktopSessionKind::Windows,
        clipboard_history: DesktopCapability::available("windowsClipboardReady"),
        clipboard_write: DesktopCapability::available("windowsClipboardReady"),
        tray_activation: DesktopCapability::available("trayActivationPending"),
        global_shortcut: DesktopCapability::available("globalShortcutPending"),
        source_app_detection: source_app_capability(),
        launch_at_login: DesktopCapability::available("windowsStartupAvailable"),
        auto_paste: DesktopCapability::available("windowsSendInputAvailable"),
    }
}

#[cfg(target_os = "linux")]
fn detect_platform_capabilities() -> DesktopCapabilities {
    linux_capabilities_from_session(
        std::env::var_os("WAYLAND_DISPLAY").is_some(),
        std::env::var_os("DISPLAY").is_some(),
    )
}

#[cfg(any(target_os = "linux", test))]
fn linux_capabilities_from_session(
    has_wayland_display: bool,
    has_x11_display: bool,
) -> DesktopCapabilities {
    let session_kind = match (has_wayland_display, has_x11_display) {
        (true, true) => DesktopSessionKind::XWayland,
        (true, false) => DesktopSessionKind::Wayland,
        (false, true) => DesktopSessionKind::X11,
        (false, false) => DesktopSessionKind::Unknown,
    };
    let pending_clipboard = if session_kind == DesktopSessionKind::Unknown {
        DesktopCapability::unavailable("displayServerUnavailable")
    } else {
        DesktopCapability::degraded("linuxClipboardBackendPending")
    };
    let source_app_detection = if session_kind == DesktopSessionKind::Wayland {
        DesktopCapability::unavailable("pureWaylandSourceIdentityUnavailable")
    } else if matches!(
        session_kind,
        DesktopSessionKind::X11 | DesktopSessionKind::XWayland
    ) {
        DesktopCapability::available("x11WmClassIdentity")
    } else {
        DesktopCapability::unavailable("displayServerUnavailable")
    };

    DesktopCapabilities {
        platform: "linux".to_string(),
        session_kind,
        clipboard_history: pending_clipboard.clone(),
        clipboard_write: pending_clipboard,
        tray_activation: DesktopCapability::degraded("trayActivationPending"),
        global_shortcut: DesktopCapability::degraded("globalShortcutPending"),
        source_app_detection,
        launch_at_login: DesktopCapability::available("xdgAutostartAvailable"),
        auto_paste: DesktopCapability::unavailable("linuxAutoPasteUnavailable"),
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn detect_platform_capabilities() -> DesktopCapabilities {
    DesktopCapabilities {
        platform: std::env::consts::OS.to_string(),
        session_kind: DesktopSessionKind::Unknown,
        clipboard_history: DesktopCapability::unavailable("platformClipboardUnavailable"),
        clipboard_write: DesktopCapability::unavailable("platformClipboardUnavailable"),
        tray_activation: DesktopCapability::unavailable("platformTrayUnavailable"),
        global_shortcut: DesktopCapability::unavailable("platformShortcutUnavailable"),
        source_app_detection: source_app_capability(),
        launch_at_login: DesktopCapability::unavailable("platformAutostartUnavailable"),
        auto_paste: DesktopCapability::unavailable("platformAutoPasteUnavailable"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        linux_capabilities_from_session, DesktopCapabilityState, DesktopCapabilityStatus,
        DesktopSessionKind,
    };

    #[test]
    fn pure_wayland_reports_source_identity_unavailable_before_runtime_probe() {
        let capabilities = linux_capabilities_from_session(true, false);

        assert_eq!(capabilities.session_kind, DesktopSessionKind::Wayland);
        assert_eq!(
            capabilities.source_app_detection.status,
            DesktopCapabilityStatus::Unavailable
        );
        assert_eq!(
            capabilities.source_app_detection.reason_code,
            "pureWaylandSourceIdentityUnavailable"
        );
    }

    #[test]
    fn desktop_capabilities_serialize_to_the_typescript_camel_case_contract() {
        let capabilities = linux_capabilities_from_session(false, true);
        let serialized = serde_json::to_value(capabilities).unwrap();

        assert_eq!(serialized["platform"], "linux");
        assert_eq!(serialized["sessionKind"], "x11");
        assert_eq!(serialized["clipboardHistory"]["status"], "degraded");
        assert_eq!(
            serialized["sourceAppDetection"]["reasonCode"],
            "x11WmClassIdentity"
        );
        for field in [
            "clipboardHistory",
            "clipboardWrite",
            "trayActivation",
            "globalShortcut",
            "sourceAppDetection",
            "launchAtLogin",
            "autoPaste",
        ] {
            assert!(serialized.get(field).is_some(), "missing {field}");
        }
    }

    #[test]
    fn xwayland_ready_is_degraded_because_backend_fallback_is_opaque() {
        let state = DesktopCapabilityState {
            inner: std::sync::Arc::new(std::sync::RwLock::new(linux_capabilities_from_session(
                true, true,
            ))),
        };

        state.record_clipboard_ready();
        let capabilities = state.snapshot();

        assert_eq!(
            capabilities.clipboard_history.status,
            DesktopCapabilityStatus::Degraded
        );
        assert_eq!(
            capabilities.clipboard_history.reason_code,
            "waylandOrXwaylandClipboardReady"
        );
    }

    #[test]
    fn tray_and_shortcut_fail_independently() {
        let state = DesktopCapabilityState {
            inner: std::sync::Arc::new(std::sync::RwLock::new(linux_capabilities_from_session(
                false, true,
            ))),
        };

        state.record_tray_result(true);
        state.record_global_shortcut_result(false);
        let capabilities = state.snapshot();

        assert_eq!(
            capabilities.tray_activation.status,
            DesktopCapabilityStatus::Available
        );
        assert_eq!(
            capabilities.global_shortcut.status,
            DesktopCapabilityStatus::Unavailable
        );
    }
}
