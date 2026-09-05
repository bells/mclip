use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri_plugin_dialog::DialogExt;

use crate::settings::{normalize_source_app_identifier, MAX_IGNORED_SOURCE_APP_COUNT};

#[cfg(any(target_os = "linux", test))]
mod linux;
#[cfg(target_os = "macos")]
mod macos;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceApplicationOption {
    pub id: String,
    pub display_name: String,
    pub icon_data_url: Option<String>,
}

static PICKER_OPEN: AtomicBool = AtomicBool::new(false);

struct PickerGuard;

impl Drop for PickerGuard {
    fn drop(&mut self) {
        PICKER_OPEN.store(false, Ordering::Release);
    }
}

#[tauri::command]
pub async fn pick_ignored_source_apps(
    window: tauri::WebviewWindow,
) -> Result<Vec<SourceApplicationOption>, &'static str> {
    if window.label() != "preferences" {
        return Err("applicationPickerUnavailable");
    }
    if crate::source_app::get_source_app_detection_status().capability
        == crate::source_app::SourceAppDetectionCapability::Unavailable
    {
        return Err("applicationPickerUnavailable");
    }
    if PICKER_OPEN.swap(true, Ordering::AcqRel) {
        return Err("applicationPickerBusy");
    }
    let guard = PickerGuard;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let picker = window.dialog().file().set_parent(&window);
        #[cfg(target_os = "macos")]
        let picker = picker
            .set_directory("/Applications")
            .add_filter("Applications", &["app"]);
        #[cfg(target_os = "windows")]
        let picker = picker.add_filter("Applications", &["exe"]);
        #[cfg(target_os = "linux")]
        let picker = picker
            .set_directory("/usr/share/applications")
            .add_filter("Applications", &["desktop"]);

        let Some(files) = picker.blocking_pick_files() else {
            return Ok(Vec::new());
        };
        if files.len() > MAX_IGNORED_SOURCE_APP_COUNT {
            return Err("applicationLimitReached");
        }
        let mut apps: Vec<SourceApplicationOption> = Vec::new();
        for file in files {
            let path = file
                .into_path()
                .map_err(|_| "applicationSelectionInvalid")?;
            let app = selected_application(&path)?;
            if !apps.iter().any(|existing| existing.id == app.id) {
                apps.push(app);
            }
        }
        Ok(apps)
    })
    .await
    .map_err(|_| "applicationPickerFailed")?
}

#[tauri::command]
pub async fn resolve_ignored_source_apps(
    window: tauri::WebviewWindow,
    identifiers: Vec<String>,
) -> Result<Vec<SourceApplicationOption>, &'static str> {
    if window.label() != "preferences" || identifiers.len() > MAX_IGNORED_SOURCE_APP_COUNT {
        return Err("applicationLookupInvalid");
    }
    let identifiers = identifiers
        .into_iter()
        .map(|id| normalize_source_app_identifier(&id).ok_or("applicationLookupInvalid"))
        .collect::<Result<Vec<_>, _>>()?;
    tauri::async_runtime::spawn_blocking(move || {
        identifiers
            .into_iter()
            .map(|id| resolve_application(&id))
            .collect()
    })
    .await
    .map_err(|_| "applicationLookupFailed")
}

fn selected_application(path: &Path) -> Result<SourceApplicationOption, &'static str> {
    #[cfg(target_os = "macos")]
    {
        macos::selected_application(path)
    }
    #[cfg(target_os = "windows")]
    {
        if !path.is_file()
            || !path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
        {
            return Err("applicationSelectionInvalid");
        }
        windows_application(
            path.file_name()
                .and_then(|value| value.to_str())
                .ok_or("applicationSelectionInvalid")?,
        )
    }
    #[cfg(target_os = "linux")]
    {
        linux::selected_application(path)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = path;
        Err("applicationPickerUnavailable")
    }
}

fn resolve_application(id: &str) -> SourceApplicationOption {
    #[cfg(target_os = "macos")]
    if let Some(app) = macos::resolve_application(id) {
        return app;
    }
    #[cfg(target_os = "linux")]
    if let Some(app) = linux::resolve_application(id) {
        return app;
    }
    let display_name = id
        .strip_prefix("windows:")
        .and_then(|name| name.strip_suffix(".exe"))
        .unwrap_or(id);
    SourceApplicationOption {
        id: id.into(),
        display_name: display_name.into(),
        icon_data_url: None,
    }
}

fn application(id: String, display_name: String) -> Result<SourceApplicationOption, &'static str> {
    let id = normalize_source_app_identifier(&id).ok_or("applicationSelectionInvalid")?;
    let display_name: String = display_name.trim().chars().take(256).collect();
    if display_name.is_empty() {
        return Err("applicationSelectionInvalid");
    }
    Ok(SourceApplicationOption {
        id,
        display_name,
        icon_data_url: None,
    })
}

#[cfg(any(target_os = "windows", test))]
fn windows_application(file_name: &str) -> Result<SourceApplicationOption, &'static str> {
    let name = file_name
        .strip_suffix(".exe")
        .or_else(|| file_name.strip_suffix(".EXE"))
        .unwrap_or(file_name);
    application(format!("windows:{file_name}"), name.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn executable_identity_matches_source_detector() {
        let app = windows_application("ChatGPT.exe").unwrap();
        assert_eq!(app.id, "windows:chatgpt.exe");
        assert_eq!(app.display_name, "ChatGPT");
    }

    #[test]
    fn invalid_identity_is_not_silently_added() {
        assert_eq!(
            windows_application("invalid app.exe").unwrap_err(),
            "applicationSelectionInvalid"
        );
        assert!(application("macos:com.example.app".into(), " ".into()).is_err());
    }

    #[test]
    fn unavailable_metadata_preserves_old_identifier() {
        let app = resolve_application("other:missing.app");
        assert_eq!(app.id, "other:missing.app");
        assert_eq!(app.display_name, "other:missing.app");
        assert!(app.icon_data_url.is_none());
    }
}
