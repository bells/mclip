//! 默认关闭的本地性能里程碑。
//! 记录结构只允许枚举和数字，避免把剪贴板内容带入性能证据。

use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::State;

const PERFORMANCE_MODE_ENV: &str = "MCLIP_PERF_MODE";
const PERFORMANCE_TRACE_PATH_ENV: &str = "MCLIP_PERF_TRACE_PATH";
const PERFORMANCE_CONFIG_DIR_ENV: &str = "MCLIP_PERF_CONFIG_DIR";
pub const PERFORMANCE_AUTOMATION_EVENT: &str = "performance-automation";
pub const PERFORMANCE_OPEN_VIEWER_ARGUMENT: &str = "--mclip-performance-action=open-viewer";
pub const PERFORMANCE_CLOSE_VIEWER_ARGUMENT: &str = "--mclip-performance-action=close-viewer";
pub const PERFORMANCE_QUIT_ARGUMENT: &str = "--mclip-performance-action=quit";
const MAX_INTERACTION_ID_CHARS: usize = 64;
const MAX_ELAPSED_MS: f64 = 3_600_000.0;
const MAX_FIXTURE_SIZE: u32 = 200;

static PROCESS_STARTED_AT: OnceLock<Instant> = OnceLock::new();
static INTERACTION_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PerformanceClock {
    Rust,
    Frontend,
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PerformanceMilestoneName {
    ProcessEntry,
    SetupStart,
    TrayReady,
    BootstrapReady,
    RouteReady,
    ListenersReady,
    HistoryReady,
    MainShowRequest,
    MainNativeVisible,
    MainPainted,
    PreviewRequest,
    PreviewNativeVisible,
    PreviewPainted,
    ViewerRequest,
    ViewerNativeVisible,
    ViewerPainted,
    ImageCacheHit,
    ImageCacheMiss,
    ImageReady,
    ImageError,
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PerformanceWindowLabel {
    Main,
    Preview,
    PreviewDetail,
    ImageViewer,
    About,
    Preferences,
}

impl PerformanceWindowLabel {
    pub fn from_window_label(label: &str) -> Option<Self> {
        match label {
            "main" => Some(Self::Main),
            "preview" => Some(Self::Preview),
            "preview-detail" => Some(Self::PreviewDetail),
            "image-viewer" => Some(Self::ImageViewer),
            "about" => Some(Self::About),
            "preferences" => Some(Self::Preferences),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PerformanceOutcome {
    Success,
    Failure,
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PerformanceAutomationAction {
    OpenViewer,
    CloseViewer,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PerformanceInteraction {
    pub interaction_id: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PerformanceMilestone {
    pub clock: PerformanceClock,
    pub milestone: PerformanceMilestoneName,
    pub window_label: Option<PerformanceWindowLabel>,
    pub interaction_id: Option<String>,
    pub elapsed_ms: f64,
    pub fixture_size: Option<u32>,
    pub outcome: PerformanceOutcome,
}

impl PerformanceMilestone {
    fn validate(&self) -> Result<(), String> {
        if !self.elapsed_ms.is_finite()
            || self.elapsed_ms.is_sign_negative()
            || self.elapsed_ms > MAX_ELAPSED_MS
        {
            return Err("performance elapsedMs is outside the allowed range".to_string());
        }

        if self
            .fixture_size
            .is_some_and(|size| size > MAX_FIXTURE_SIZE)
        {
            return Err("performance fixtureSize is outside the allowed range".to_string());
        }

        if let Some(interaction_id) = &self.interaction_id {
            if interaction_id.is_empty()
                || interaction_id.chars().count() > MAX_INTERACTION_ID_CHARS
                || !interaction_id
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
            {
                return Err("performance interactionId is invalid".to_string());
            }
        }

        Ok(())
    }
}

#[derive(Debug)]
pub struct PerformanceRecorder {
    sender: Option<Sender<PerformanceMilestone>>,
}

impl PerformanceRecorder {
    pub fn from_env() -> Result<Self, String> {
        if env::var(PERFORMANCE_MODE_ENV).as_deref() != Ok("1") {
            return Ok(Self { sender: None });
        }

        let trace_path = env::var_os(PERFORMANCE_TRACE_PATH_ENV)
            .map(PathBuf::from)
            .ok_or_else(|| {
                format!("{PERFORMANCE_TRACE_PATH_ENV} is required in performance mode")
            })?;
        if !trace_path.is_absolute() {
            return Err(format!("{PERFORMANCE_TRACE_PATH_ENV} must be absolute"));
        }

        if let Some(parent) = trace_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let (sender, receiver) = mpsc::channel::<PerformanceMilestone>();
        thread::Builder::new()
            .name("mclip-performance-writer".to_string())
            .spawn(move || {
                while let Ok(milestone) = receiver.recv() {
                    let Ok(line) = serde_json::to_string(&milestone) else {
                        continue;
                    };
                    let Ok(mut file) = OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&trace_path)
                    else {
                        continue;
                    };
                    let _ = writeln!(file, "{line}");
                }
            })
            .map_err(|error| error.to_string())?;

        Ok(Self {
            sender: Some(sender),
        })
    }

    pub fn is_enabled(&self) -> bool {
        self.sender.is_some()
    }

    pub fn record(&self, milestone: PerformanceMilestone) -> Result<(), String> {
        milestone.validate()?;
        match &self.sender {
            Some(sender) => sender.send(milestone).map_err(|error| error.to_string()),
            None => Ok(()),
        }
    }
}

pub fn mark_process_entry() {
    let _ = PROCESS_STARTED_AT.set(Instant::now());
}

pub fn process_elapsed_ms() -> f64 {
    PROCESS_STARTED_AT
        .get_or_init(Instant::now)
        .elapsed()
        .as_secs_f64()
        * 1_000.0
}

pub fn next_interaction_id(prefix: &str) -> String {
    let sequence = INTERACTION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{sequence}")
}

pub fn record_rust_milestone(
    recorder: &PerformanceRecorder,
    milestone: PerformanceMilestoneName,
    window_label: Option<PerformanceWindowLabel>,
    interaction_id: Option<String>,
    outcome: PerformanceOutcome,
) {
    let _ = recorder.record(PerformanceMilestone {
        clock: PerformanceClock::Rust,
        milestone,
        window_label,
        interaction_id,
        elapsed_ms: process_elapsed_ms(),
        fixture_size: performance_fixture_size(),
        outcome,
    });
}

fn performance_fixture_size() -> Option<u32> {
    env::var("MCLIP_PERF_FIXTURE_SIZE")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|size| *size <= MAX_FIXTURE_SIZE)
}

pub fn performance_config_dir_override() -> Result<Option<PathBuf>, String> {
    if env::var(PERFORMANCE_MODE_ENV).as_deref() != Ok("1") {
        return Ok(None);
    }

    let Some(config_dir) = env::var_os(PERFORMANCE_CONFIG_DIR_ENV).map(PathBuf::from) else {
        return Ok(None);
    };
    validate_performance_config_dir(&config_dir, &env::temp_dir()).map(Some)
}

fn validate_performance_config_dir(
    config_dir: &std::path::Path,
    temp_root: &std::path::Path,
) -> Result<PathBuf, String> {
    let config_dir = config_dir
        .canonicalize()
        .map_err(|error| format!("invalid {PERFORMANCE_CONFIG_DIR_ENV}: {error}"))?;
    let temp_root = temp_root
        .canonicalize()
        .map_err(|error| format!("failed to resolve temporary directory: {error}"))?;

    if config_dir == temp_root || !config_dir.starts_with(&temp_root) {
        return Err(format!(
            "{PERFORMANCE_CONFIG_DIR_ENV} must resolve inside {}",
            temp_root.display()
        ));
    }

    Ok(config_dir)
}

#[tauri::command]
pub fn is_performance_mode_enabled(recorder: State<'_, PerformanceRecorder>) -> bool {
    recorder.is_enabled()
}

#[tauri::command]
pub fn record_frontend_performance(
    recorder: State<'_, PerformanceRecorder>,
    milestone: PerformanceMilestone,
) -> Result<(), String> {
    if milestone.clock != PerformanceClock::Frontend {
        return Err("frontend performance command requires the frontend clock".to_string());
    }

    let rust_receipt =
        frontend_receipt_at(&milestone, process_elapsed_ms(), performance_fixture_size());
    recorder.record(milestone)?;
    recorder.record(rust_receipt)
}

fn frontend_receipt_at(
    milestone: &PerformanceMilestone,
    elapsed_ms: f64,
    fixture_size: Option<u32>,
) -> PerformanceMilestone {
    PerformanceMilestone {
        clock: PerformanceClock::Rust,
        milestone: milestone.milestone,
        window_label: milestone.window_label,
        interaction_id: milestone.interaction_id.clone(),
        elapsed_ms,
        fixture_size,
        outcome: milestone.outcome,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        PerformanceClock, PerformanceMilestone, PerformanceMilestoneName, PerformanceOutcome,
        PerformanceWindowLabel,
    };

    #[test]
    fn performance_payload_rejects_unknown_content_fields() {
        let payload = serde_json::json!({
            "clock": "frontend",
            "milestone": "historyReady",
            "windowLabel": "main",
            "interactionId": "startup-1",
            "elapsedMs": 12.5,
            "fixtureSize": 50,
            "outcome": "success",
            "clipboardText": "secret"
        });

        assert!(serde_json::from_value::<PerformanceMilestone>(payload).is_err());
    }

    #[test]
    fn performance_payload_accepts_only_safe_interaction_ids() {
        let safe = PerformanceMilestone {
            clock: PerformanceClock::Frontend,
            milestone: PerformanceMilestoneName::PreviewPainted,
            window_label: Some(PerformanceWindowLabel::Preview),
            interaction_id: Some("preview-42".to_string()),
            elapsed_ms: 8.0,
            fixture_size: Some(50),
            outcome: PerformanceOutcome::Success,
        };
        assert!(safe.validate().is_ok());

        let unsafe_payload = PerformanceMilestone {
            interaction_id: Some("/Users/example/clipboard.txt".to_string()),
            ..safe
        };
        assert!(unsafe_payload.validate().is_err());
    }

    #[test]
    fn performance_config_override_is_limited_to_temp_root() {
        let temp_root = std::env::temp_dir();
        let fixture_dir = temp_root.join(format!("mclip-performance-test-{}", std::process::id()));
        std::fs::create_dir_all(&fixture_dir).unwrap();

        assert!(super::validate_performance_config_dir(&fixture_dir, &temp_root).is_ok());
        assert!(
            super::validate_performance_config_dir(std::path::Path::new("/"), &temp_root).is_err()
        );
    }

    #[test]
    fn frontend_receipt_preserves_safe_correlation_in_the_rust_clock() {
        let frontend = PerformanceMilestone {
            clock: PerformanceClock::Frontend,
            milestone: PerformanceMilestoneName::ViewerPainted,
            window_label: Some(PerformanceWindowLabel::ImageViewer),
            interaction_id: Some("viewer-17".to_string()),
            elapsed_ms: 12.0,
            fixture_size: None,
            outcome: PerformanceOutcome::Success,
        };

        let receipt = super::frontend_receipt_at(&frontend, 24.5, Some(50));

        assert_eq!(receipt.clock, PerformanceClock::Rust);
        assert_eq!(receipt.milestone, PerformanceMilestoneName::ViewerPainted);
        assert_eq!(
            receipt.window_label,
            Some(PerformanceWindowLabel::ImageViewer)
        );
        assert_eq!(receipt.interaction_id.as_deref(), Some("viewer-17"));
        assert_eq!(receipt.elapsed_ms, 24.5);
        assert_eq!(receipt.fixture_size, Some(50));
        assert_eq!(receipt.outcome, PerformanceOutcome::Success);
    }
}
