//! 辅助窗口的纯数据契约与 ready generation 状态机。
//! 这里不依赖 Tauri runtime，确保单元测试不会链接 WebView/Win32 GUI 入口。

use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

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

pub const AUXILIARY_WINDOW_DESCRIPTORS: [AuxiliaryWindowDescriptor; 6] = [
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
        label: "quick-action",
        title: "mclip Text Action",
        url: "index.html",
        size: LogicalWindowSize {
            width: 560.0,
            height: 420.0,
        },
        min_size: Some(LogicalWindowSize {
            width: 560.0,
            height: 420.0,
        }),
        max_size: Some(LogicalWindowSize {
            width: 560.0,
            height: 420.0,
        }),
        transparent: true,
        focusable: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        decorations: false,
        // The main popover stays always-on-top while text actions are open.
        // Keep the focused result window in the same native level so it is
        // ordered above the main window instead of being covered by it.
        always_on_top: true,
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
pub(crate) enum EnsureReservation {
    Create(u64),
    Wait(u64),
    Reuse(u64),
}

#[derive(Debug, Clone, Default)]
pub struct AuxiliaryWindowRegistry {
    shared: Arc<(Mutex<AuxiliaryRegistryState>, Condvar)>,
}

impl AuxiliaryWindowRegistry {
    pub(crate) fn reserve(&self, label: &'static str, window_exists: bool) -> EnsureReservation {
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

    pub(crate) fn mark_ready(&self, label: &str, generation: u64) -> bool {
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

    pub(crate) fn remove_generation(&self, label: &str, generation: u64) {
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

    pub(crate) fn wait_until_ready(
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
    fn descriptors_preserve_auxiliary_window_contract() {
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
                "quick-action",
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

        let quick_action = auxiliary_window_descriptor("quick-action").unwrap();
        assert!(quick_action.focusable);
        assert!(quick_action.always_on_top);

        for (label, size) in [
            (
                "about",
                LogicalWindowSize {
                    width: 360.0,
                    height: 360.0,
                },
            ),
            (
                "quick-action",
                LogicalWindowSize {
                    width: 560.0,
                    height: 420.0,
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
