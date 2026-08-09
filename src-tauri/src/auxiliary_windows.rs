//! 按需创建的辅助 WebView 描述与生命周期注册表。
//! 描述符集中保留原 tauri.conf.json 的窗口属性，避免创建路径逐个漂移。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LogicalWindowSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacosCornerBehavior {
    Rounded,
    Standard,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AuxiliaryWindowDescriptor {
    pub label: &'static str,
    pub title: &'static str,
    pub url: &'static str,
    pub size: LogicalWindowSize,
    pub min_size: Option<LogicalWindowSize>,
    pub max_size: Option<LogicalWindowSize>,
    pub transparent: bool,
    pub focusable: bool,
    pub resizable: bool,
    pub maximizable: bool,
    pub minimizable: bool,
    pub decorations: bool,
    pub always_on_top: bool,
    pub skip_taskbar: bool,
    pub shadow: bool,
    pub macos_corner_behavior: MacosCornerBehavior,
    pub capability_identifiers: &'static [&'static str],
}

const DESKTOP_CAPABILITIES: &[&str] = &["default", "desktop-capability"];

pub const AUXILIARY_WINDOW_DESCRIPTORS: [AuxiliaryWindowDescriptor; 5] = [
    AuxiliaryWindowDescriptor {
        label: "preview",
        title: "mclip preview",
        url: "index.html",
        size: LogicalWindowSize {
            width: 304.0,
            height: 180.0,
        },
        min_size: None,
        max_size: None,
        transparent: true,
        focusable: false,
        resizable: false,
        maximizable: true,
        minimizable: true,
        decorations: false,
        always_on_top: true,
        skip_taskbar: true,
        shadow: false,
        macos_corner_behavior: MacosCornerBehavior::Rounded,
        capability_identifiers: DESKTOP_CAPABILITIES,
    },
    AuxiliaryWindowDescriptor {
        label: "preview-detail",
        title: "mclip preview detail",
        url: "index.html",
        size: LogicalWindowSize {
            width: 312.0,
            height: 220.0,
        },
        min_size: None,
        max_size: None,
        transparent: true,
        focusable: false,
        resizable: false,
        maximizable: true,
        minimizable: true,
        decorations: false,
        always_on_top: true,
        skip_taskbar: true,
        shadow: false,
        macos_corner_behavior: MacosCornerBehavior::Rounded,
        capability_identifiers: DESKTOP_CAPABILITIES,
    },
    AuxiliaryWindowDescriptor {
        label: "image-viewer",
        title: "mclip image viewer",
        url: "index.html",
        size: LogicalWindowSize {
            width: 720.0,
            height: 520.0,
        },
        min_size: None,
        max_size: None,
        transparent: false,
        focusable: true,
        resizable: true,
        maximizable: true,
        minimizable: false,
        decorations: false,
        always_on_top: false,
        skip_taskbar: true,
        shadow: true,
        macos_corner_behavior: MacosCornerBehavior::Standard,
        capability_identifiers: DESKTOP_CAPABILITIES,
    },
    AuxiliaryWindowDescriptor {
        label: "about",
        title: "About mclip",
        url: "index.html",
        size: LogicalWindowSize {
            width: 360.0,
            height: 360.0,
        },
        min_size: Some(LogicalWindowSize {
            width: 360.0,
            height: 360.0,
        }),
        max_size: Some(LogicalWindowSize {
            width: 360.0,
            height: 360.0,
        }),
        transparent: true,
        focusable: true,
        resizable: false,
        maximizable: true,
        minimizable: true,
        decorations: false,
        always_on_top: false,
        skip_taskbar: true,
        shadow: true,
        macos_corner_behavior: MacosCornerBehavior::Rounded,
        capability_identifiers: DESKTOP_CAPABILITIES,
    },
    AuxiliaryWindowDescriptor {
        label: "preferences",
        title: "mclip Preferences",
        url: "index.html",
        size: LogicalWindowSize {
            width: 600.0,
            height: 480.0,
        },
        min_size: Some(LogicalWindowSize {
            width: 600.0,
            height: 480.0,
        }),
        max_size: Some(LogicalWindowSize {
            width: 600.0,
            height: 480.0,
        }),
        transparent: true,
        focusable: true,
        resizable: false,
        maximizable: true,
        minimizable: true,
        decorations: false,
        always_on_top: false,
        skip_taskbar: true,
        shadow: true,
        macos_corner_behavior: MacosCornerBehavior::Rounded,
        capability_identifiers: DESKTOP_CAPABILITIES,
    },
];

pub fn auxiliary_window_descriptor(label: &str) -> Option<&'static AuxiliaryWindowDescriptor> {
    AUXILIARY_WINDOW_DESCRIPTORS
        .iter()
        .find(|descriptor| descriptor.label == label)
}

const AUXILIARY_READY_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuxiliaryReadyState {
    Creating,
    Ready,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct AuxiliaryWindowRecord {
    generation: u64,
    state: AuxiliaryReadyState,
}

#[derive(Debug, Default)]
struct AuxiliaryRegistryState {
    next_generation: u64,
    records: HashMap<&'static str, AuxiliaryWindowRecord>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EnsureReservation {
    Create(u64),
    Wait(u64),
    Reuse(u64),
}

#[derive(Debug, Clone, Default)]
pub struct AuxiliaryWindowRegistry {
    shared: Arc<(Mutex<AuxiliaryRegistryState>, Condvar)>,
}

impl AuxiliaryWindowRegistry {
    fn reserve(&self, label: &'static str, window_exists: bool) -> EnsureReservation {
        let (state_lock, _) = &*self.shared;
        let mut state = state_lock.lock().unwrap_or_else(|error| error.into_inner());

        if !window_exists {
            state.records.remove(label);
        }

        if let Some(record) = state.records.get(label) {
            return match record.state {
                AuxiliaryReadyState::Creating => EnsureReservation::Wait(record.generation),
                AuxiliaryReadyState::Ready => EnsureReservation::Reuse(record.generation),
            };
        }

        state.next_generation = state.next_generation.saturating_add(1).max(1);
        let generation = state.next_generation;
        state.records.insert(
            label,
            AuxiliaryWindowRecord {
                generation,
                state: AuxiliaryReadyState::Creating,
            },
        );
        EnsureReservation::Create(generation)
    }

    fn mark_ready(&self, label: &str, generation: u64) -> bool {
        let (state_lock, ready_condition) = &*self.shared;
        let mut state = state_lock.lock().unwrap_or_else(|error| error.into_inner());
        let Some(record) = state.records.get_mut(label) else {
            return false;
        };
        if record.generation != generation {
            return false;
        }

        record.state = AuxiliaryReadyState::Ready;
        ready_condition.notify_all();
        true
    }

    fn remove_generation(&self, label: &str, generation: u64) {
        let (state_lock, ready_condition) = &*self.shared;
        let mut state = state_lock.lock().unwrap_or_else(|error| error.into_inner());
        if state
            .records
            .get(label)
            .is_some_and(|record| record.generation == generation)
        {
            state.records.remove(label);
            ready_condition.notify_all();
        }
    }

    pub fn remove_label(&self, label: &str) {
        let (state_lock, ready_condition) = &*self.shared;
        let mut state = state_lock.lock().unwrap_or_else(|error| error.into_inner());
        if state.records.remove(label).is_some() {
            ready_condition.notify_all();
        }
    }

    fn wait_until_ready(
        &self,
        label: &'static str,
        generation: u64,
        timeout: Duration,
    ) -> Result<u64, String> {
        let deadline = Instant::now() + timeout;
        let (state_lock, ready_condition) = &*self.shared;
        let mut state = state_lock.lock().unwrap_or_else(|error| error.into_inner());

        loop {
            let record = state.records.get(label).copied().ok_or_else(|| {
                format!("auxiliary window {label} generation {generation} was removed")
            })?;
            if record.generation != generation {
                return Err(format!(
                    "auxiliary window {label} generation {generation} was replaced by {}",
                    record.generation
                ));
            }
            if record.state == AuxiliaryReadyState::Ready {
                return Ok(generation);
            }

            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!(
                    "timed out waiting for auxiliary window {label} generation {generation} readiness"
                ));
            }
            let (next_state, wait_result) = ready_condition
                .wait_timeout(state, remaining)
                .unwrap_or_else(|error| error.into_inner());
            state = next_state;
            if wait_result.timed_out() {
                return Err(format!(
                    "timed out waiting for auxiliary window {label} generation {generation} readiness"
                ));
            }
        }
    }
}

fn build_auxiliary_window(
    app_handle: &AppHandle,
    descriptor: &AuxiliaryWindowDescriptor,
    generation: u64,
) -> Result<WebviewWindow, String> {
    let url = format!("{}?mclipWindowGeneration={generation}", descriptor.url);
    let mut builder = WebviewWindowBuilder::new(
        app_handle,
        descriptor.label,
        WebviewUrl::App(PathBuf::from(url)),
    )
    .title(descriptor.title)
    .inner_size(descriptor.size.width, descriptor.size.height)
    .transparent(descriptor.transparent)
    .focusable(descriptor.focusable)
    .resizable(descriptor.resizable)
    .maximizable(descriptor.maximizable)
    .minimizable(descriptor.minimizable)
    .decorations(descriptor.decorations)
    .always_on_top(descriptor.always_on_top)
    .skip_taskbar(descriptor.skip_taskbar)
    .shadow(descriptor.shadow)
    .visible(false);

    if let Some(min_size) = descriptor.min_size {
        builder = builder.min_inner_size(min_size.width, min_size.height);
    }
    if let Some(max_size) = descriptor.max_size {
        builder = builder.max_inner_size(max_size.width, max_size.height);
    }

    let window = builder.build().map_err(|error| error.to_string())?;
    if descriptor.macos_corner_behavior == MacosCornerBehavior::Rounded {
        crate::window::apply_auxiliary_window_corner_radius(app_handle, descriptor.label);
    }
    Ok(window)
}

pub async fn ensure_auxiliary_window_ready(
    app_handle: &AppHandle,
    label: &str,
) -> Result<u64, String> {
    let descriptor = auxiliary_window_descriptor(label)
        .ok_or_else(|| format!("unknown auxiliary window label: {label}"))?;
    let registry = app_handle
        .state::<AuxiliaryWindowRegistry>()
        .inner()
        .clone();
    let reservation = registry.reserve(
        descriptor.label,
        app_handle.get_webview_window(descriptor.label).is_some(),
    );
    let generation = match reservation {
        EnsureReservation::Reuse(generation) => return Ok(generation),
        EnsureReservation::Wait(generation) => generation,
        EnsureReservation::Create(generation) => {
            if let Err(error) = build_auxiliary_window(app_handle, descriptor, generation) {
                registry.remove_generation(descriptor.label, generation);
                return Err(format!(
                    "failed to create auxiliary window {}: {error}",
                    descriptor.label
                ));
            }
            generation
        }
    };

    let waiter_registry = registry.clone();
    let wait_result = tauri::async_runtime::spawn_blocking(move || {
        waiter_registry.wait_until_ready(descriptor.label, generation, AUXILIARY_READY_TIMEOUT)
    })
    .await
    .map_err(|error| error.to_string())?;

    if let Err(error) = wait_result {
        registry.remove_generation(descriptor.label, generation);
        if let Some(window) = app_handle.get_webview_window(descriptor.label) {
            let _ = window.destroy();
        }
        return Err(error);
    }

    Ok(generation)
}

#[tauri::command]
pub async fn ensure_auxiliary_window(app_handle: AppHandle, label: String) -> Result<u64, String> {
    ensure_auxiliary_window_ready(&app_handle, &label).await
}

#[tauri::command]
pub fn mark_auxiliary_window_ready(
    window: WebviewWindow,
    registry: State<'_, AuxiliaryWindowRegistry>,
    generation: u64,
) -> Result<bool, String> {
    if auxiliary_window_descriptor(window.label()).is_none() {
        return Err(format!(
            "window {} is not a registered auxiliary window",
            window.label()
        ));
    }

    Ok(registry.mark_ready(window.label(), generation))
}

#[cfg(test)]
mod tests {
    use std::thread;
    use std::time::Duration;

    use serde_json::Value;

    use super::{
        auxiliary_window_descriptor, AuxiliaryWindowRegistry, EnsureReservation, LogicalWindowSize,
        MacosCornerBehavior, AUXILIARY_WINDOW_DESCRIPTORS,
    };

    #[test]
    fn descriptors_preserve_exact_v011_auxiliary_window_contract() {
        assert_eq!(
            AUXILIARY_WINDOW_DESCRIPTORS
                .iter()
                .map(|descriptor| descriptor.label)
                .collect::<Vec<_>>(),
            vec![
                "preview",
                "preview-detail",
                "image-viewer",
                "about",
                "preferences"
            ]
        );

        let preview = auxiliary_window_descriptor("preview").unwrap();
        assert_eq!(
            preview.size,
            LogicalWindowSize {
                width: 304.0,
                height: 180.0
            }
        );
        assert!(preview.transparent);
        assert!(!preview.focusable);
        assert!(!preview.resizable);
        assert!(preview.always_on_top);
        assert!(preview.skip_taskbar);
        assert!(!preview.decorations);
        assert!(!preview.shadow);
        assert_eq!(preview.macos_corner_behavior, MacosCornerBehavior::Rounded);

        let viewer = auxiliary_window_descriptor("image-viewer").unwrap();
        assert_eq!(
            viewer.size,
            LogicalWindowSize {
                width: 720.0,
                height: 520.0
            }
        );
        assert!(!viewer.transparent);
        assert!(viewer.focusable);
        assert!(viewer.resizable);
        assert!(viewer.maximizable);
        assert!(!viewer.minimizable);
        assert!(!viewer.always_on_top);
        assert!(viewer.shadow);
        assert_eq!(viewer.macos_corner_behavior, MacosCornerBehavior::Standard);

        for (label, size) in [
            (
                "about",
                LogicalWindowSize {
                    width: 360.0,
                    height: 360.0,
                },
            ),
            (
                "preferences",
                LogicalWindowSize {
                    width: 600.0,
                    height: 480.0,
                },
            ),
        ] {
            let descriptor = auxiliary_window_descriptor(label).unwrap();
            assert_eq!(descriptor.size, size);
            assert_eq!(descriptor.min_size, Some(size));
            assert_eq!(descriptor.max_size, Some(size));
            assert!(!descriptor.resizable);
            assert_eq!(
                descriptor.macos_corner_behavior,
                MacosCornerBehavior::Rounded
            );
        }
    }

    #[test]
    fn every_descriptor_label_remains_in_exact_desktop_capability_scopes() {
        let capability_files = [
            include_str!("../capabilities/default.json"),
            include_str!("../capabilities/desktop.json"),
        ];

        for capability_source in capability_files {
            let capability: Value = serde_json::from_str(capability_source).unwrap();
            let windows = capability["windows"].as_array().unwrap();
            for descriptor in AUXILIARY_WINDOW_DESCRIPTORS {
                assert!(
                    windows.iter().any(|window| window == descriptor.label),
                    "{} is missing from capability {}",
                    descriptor.label,
                    capability["identifier"]
                );
                assert_eq!(
                    descriptor.capability_identifiers,
                    ["default", "desktop-capability"]
                );
            }
        }
    }

    #[test]
    fn registry_coalesces_concurrent_ensure_and_reuses_ready_generation() {
        let registry = AuxiliaryWindowRegistry::default();
        let first = registry.reserve("preview", false);
        let EnsureReservation::Create(generation) = first else {
            panic!("first ensure must create");
        };

        assert_eq!(
            registry.reserve("preview", true),
            EnsureReservation::Wait(generation)
        );
        assert!(registry.mark_ready("preview", generation));
        assert_eq!(
            registry.reserve("preview", true),
            EnsureReservation::Reuse(generation)
        );
        assert_eq!(
            registry.wait_until_ready("preview", generation, Duration::from_millis(1)),
            Ok(generation)
        );
    }

    #[test]
    fn registry_ignores_late_ready_and_recovers_after_timeout_cleanup() {
        let registry = AuxiliaryWindowRegistry::default();
        let EnsureReservation::Create(first_generation) = registry.reserve("preview", false) else {
            panic!("first ensure must create");
        };

        assert!(registry
            .wait_until_ready("preview", first_generation, Duration::from_millis(1))
            .unwrap_err()
            .contains("timed out"));
        registry.remove_generation("preview", first_generation);
        let EnsureReservation::Create(second_generation) = registry.reserve("preview", false)
        else {
            panic!("retry must create a new generation");
        };
        assert!(second_generation > first_generation);
        assert!(!registry.mark_ready("preview", first_generation));

        let waiter_registry = registry.clone();
        let waiter = thread::spawn(move || {
            waiter_registry.wait_until_ready(
                "preview",
                second_generation,
                Duration::from_millis(100),
            )
        });
        thread::sleep(Duration::from_millis(5));
        assert!(registry.mark_ready("preview", second_generation));
        assert_eq!(waiter.join().unwrap(), Ok(second_generation));
    }
}
