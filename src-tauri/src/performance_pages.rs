//! Opt-in, fixture-only native page-response automation. No arbitrary inputs.
use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::performance::{
    next_interaction_id, performance_config_dir_override, record_rust_milestone,
    PerformanceMilestoneName, PerformanceOutcome, PerformanceRecorder, PerformanceWindowLabel,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PerformancePageAction {
    OpenAbout,
    OpenPreferences,
    OpenQuickAction,
    PreferencesGeneral,
    PreferencesAppearance,
    PreferencesHistory,
    PreferencesPrivacy,
    PreferencesTextActions,
    PreferencesCli,
    PreferencesSearch,
    PreferencesSave,
}

impl PerformancePageAction {
    pub fn from_argument(argument: &str) -> Option<Self> {
        Some(match argument {
            "--mclip-performance-page=about" => Self::OpenAbout,
            "--mclip-performance-page=preferences" => Self::OpenPreferences,
            "--mclip-performance-page=quick-action" => Self::OpenQuickAction,
            "--mclip-performance-page=preferences-general" => Self::PreferencesGeneral,
            "--mclip-performance-page=preferences-appearance" => Self::PreferencesAppearance,
            "--mclip-performance-page=preferences-history" => Self::PreferencesHistory,
            "--mclip-performance-page=preferences-privacy" => Self::PreferencesPrivacy,
            "--mclip-performance-page=preferences-text-actions" => Self::PreferencesTextActions,
            "--mclip-performance-page=preferences-cli" => Self::PreferencesCli,
            "--mclip-performance-page=preferences-search" => Self::PreferencesSearch,
            "--mclip-performance-page=preferences-save" => Self::PreferencesSave,
            _ => return None,
        })
    }

    fn label(self) -> (&'static str, PerformanceWindowLabel) {
        match self {
            Self::OpenAbout => ("about", PerformanceWindowLabel::About),
            Self::OpenQuickAction => ("quick-action", PerformanceWindowLabel::QuickAction),
            _ => ("preferences", PerformanceWindowLabel::Preferences),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformancePageRequest {
    action: PerformancePageAction,
    interaction_id: String,
}

pub async fn run(app: AppHandle, action: PerformancePageAction) -> Result<(), String> {
    if !app.state::<PerformanceRecorder>().is_enabled()
        || performance_config_dir_override()?.is_none()
    {
        return Err("pageProbeRequiresIsolatedFixture".into());
    }
    let (target, label) = action.label();
    let interaction_id = next_interaction_id("page");
    record_rust_milestone(
        &app.state::<PerformanceRecorder>(),
        PerformanceMilestoneName::PageRequest,
        Some(label),
        Some(interaction_id.clone()),
        PerformanceOutcome::Success,
    );
    let result = async {
        if matches!(
            action,
            PerformancePageAction::OpenAbout
                | PerformancePageAction::OpenPreferences
                | PerformancePageAction::OpenQuickAction
        ) {
            for label in ["about", "preferences", "quick-action"] {
                if let Some(window) = app.get_webview_window(label) {
                    window.hide().map_err(|_| "pageProbeHideFailed")?;
                }
            }
        }
        match action {
            PerformancePageAction::OpenAbout => {
                crate::window::show_about_window(app.clone()).await?
            }
            PerformancePageAction::OpenQuickAction => {
                crate::window::show_quick_action_window(app.clone()).await?
            }
            PerformancePageAction::OpenPreferences => {
                crate::window::show_preferences_window(app.clone()).await?
            }
            _ => {}
        }
        let probe_label =
            PerformanceWindowLabel::from_window_label(target).ok_or("pageProbeInvalidLabel")?;
        let handle = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let start = Instant::now();
            while !handle
                .state::<PerformanceRecorder>()
                .page_probe_ready(probe_label)
            {
                if start.elapsed() > Duration::from_secs(5) {
                    return Err("pageProbeReadyTimedOut".to_string());
                }
                std::thread::sleep(Duration::from_millis(5));
            }
            Ok(())
        })
        .await
        .map_err(|_| "pageProbeWaitFailed")??;
        record_rust_milestone(
            &app.state::<PerformanceRecorder>(),
            PerformanceMilestoneName::PageDispatchReady,
            Some(label),
            Some(interaction_id.clone()),
            PerformanceOutcome::Success,
        );
        app.emit_to(
            target,
            "performance-page-action",
            PerformancePageRequest {
                action,
                interaction_id: interaction_id.clone(),
            },
        )
        .map_err(|_| "pageProbeEmitFailed".to_string())
    }
    .await;
    if result.is_err() {
        record_rust_milestone(
            &app.state::<PerformanceRecorder>(),
            PerformanceMilestoneName::PagePainted,
            Some(label),
            Some(interaction_id),
            PerformanceOutcome::Failure,
        );
    }
    result
}

#[cfg(test)]
mod tests {
    use super::PerformancePageAction;
    #[test]
    fn page_arguments_are_an_exact_allowlist() {
        assert_eq!(
            PerformancePageAction::from_argument("--mclip-performance-page=about"),
            Some(PerformancePageAction::OpenAbout)
        );
        for value in [
            "about",
            "--mclip-performance-page=/tmp/private",
            "--mclip-performance-page=install",
            "--mclip-performance-page=preferences ",
        ] {
            assert_eq!(PerformancePageAction::from_argument(value), None);
        }
    }
}
