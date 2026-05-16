use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::history::trim_history_to_max;
use crate::storage::write_text_atomically;

pub const DEFAULT_MAX_HISTORY_COUNT: u32 = 50;
pub const MIN_MAX_HISTORY_COUNT: u32 = 10;
pub const MAX_MAX_HISTORY_COUNT: u32 = 200;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub max_history_count: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            max_history_count: DEFAULT_MAX_HISTORY_COUNT,
        }
    }
}

impl AppSettings {
    pub fn sanitize(mut self) -> Self {
        self.max_history_count = self
            .max_history_count
            .clamp(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT);
        self
    }
}

#[tauri::command]
pub fn get_settings(app_handle: AppHandle) -> Result<AppSettings, String> {
    load_settings(&app_handle)
}

#[tauri::command]
pub fn save_settings(app_handle: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    persist_settings(&app_handle, settings)
}

pub fn load_settings(app_handle: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;
    let mut settings = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        match serde_json::from_str::<AppSettings>(&content) {
            Ok(settings) => settings.sanitize(),
            Err(error) => {
                eprintln!("failed to parse settings, using defaults: {error}");
                AppSettings::default()
            }
        }
    } else {
        AppSettings::default()
    };

    settings.launch_at_login = launch_agent_enabled(app_handle)?;

    Ok(settings)
}

fn persist_settings(app_handle: &AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let settings = settings.sanitize();
    sync_launch_at_login(app_handle, settings.launch_at_login)?;
    trim_history_to_max(app_handle, settings.max_history_count as usize)?;

    let path = settings_path(app_handle)?;
    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    write_text_atomically(&path, &content)?;

    load_settings(app_handle)
}

fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(config_dir.join("settings.json"))
}

#[cfg(target_os = "macos")]
fn launch_agent_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let home_dir = app_handle
        .path()
        .home_dir()
        .map_err(|error| error.to_string())?;

    Ok(home_dir
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{}.plist", app_handle.config().identifier)))
}

#[cfg(target_os = "windows")]
fn windows_startup_script_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .ok_or_else(|| "APPDATA environment variable is not set".to_string())?;

    Ok(PathBuf::from(app_data)
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Startup")
        .join(format!("{}.cmd", app_handle.config().identifier)))
}

#[cfg(target_os = "windows")]
fn windows_startup_script_contents(executable: &std::path::Path) -> String {
    format!(
        "@echo off\r\nstart \"\" \"{}\"\r\n",
        executable.to_string_lossy()
    )
}

fn launch_agent_enabled(app_handle: &AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(launch_agent_path(app_handle)?.exists())
    }

    #[cfg(target_os = "windows")]
    {
        Ok(windows_startup_script_path(app_handle)?.exists())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app_handle;
        Ok(false)
    }
}

fn sync_launch_at_login(app_handle: &AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let plist_path = launch_agent_path(app_handle)?;

        if enabled {
            if let Some(parent) = plist_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }

            let executable = std::env::current_exe().map_err(|error| error.to_string())?;
            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{program}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>"#,
                label = app_handle.config().identifier,
                program = executable.to_string_lossy().replace('&', "&amp;"),
            );

            fs::write(&plist_path, plist_content).map_err(|error| error.to_string())?;
        } else if plist_path.exists() {
            fs::remove_file(&plist_path).map_err(|error| error.to_string())?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        let startup_script_path = windows_startup_script_path(app_handle)?;

        if enabled {
            if let Some(parent) = startup_script_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }

            let executable = std::env::current_exe().map_err(|error| error.to_string())?;
            let script = windows_startup_script_contents(&executable);

            fs::write(&startup_script_path, script).map_err(|error| error.to_string())?;
        } else if startup_script_path.exists() {
            fs::remove_file(&startup_script_path).map_err(|error| error.to_string())?;
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app_handle, enabled);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{AppSettings, MAX_MAX_HISTORY_COUNT, MIN_MAX_HISTORY_COUNT};

    #[test]
    fn sanitize_clamps_history_count_to_lower_bound() {
        let settings = AppSettings {
            launch_at_login: false,
            max_history_count: 1,
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MIN_MAX_HISTORY_COUNT);
    }

    #[test]
    fn sanitize_clamps_history_count_to_upper_bound() {
        let settings = AppSettings {
            launch_at_login: false,
            max_history_count: 999,
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MAX_MAX_HISTORY_COUNT);
    }
}
