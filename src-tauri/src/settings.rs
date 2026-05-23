//! 应用偏好设置。
//! 负责语言、历史条数、登录启动等配置的持久化，并同步平台启动项。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::history::{trim_history_to_max, HistoryKind};
use crate::storage::write_text_atomically;

pub const DEFAULT_MAX_HISTORY_COUNT: u32 = 50;
pub const MIN_MAX_HISTORY_COUNT: u32 = 10;
pub const MAX_MAX_HISTORY_COUNT: u32 = 200;
pub const SETTINGS_UPDATED_EVENT: &str = "settings-updated";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppLanguage {
    ZhCn,
    En,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    #[serde(default = "default_language")]
    pub language: AppLanguage,
    pub max_history_count: u32,
    #[serde(default)]
    pub enabled_history_types: HistoryTypes,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryTypes {
    pub text: bool,
    pub url: bool,
    pub image: bool,
    pub files: bool,
}

impl Default for HistoryTypes {
    fn default() -> Self {
        Self {
            text: true,
            url: true,
            image: true,
            files: true,
        }
    }
}

impl HistoryTypes {
    pub fn is_enabled(&self, kind: HistoryKind) -> bool {
        match kind {
            HistoryKind::Text => self.text,
            HistoryKind::Url => self.url,
            HistoryKind::Image => self.image,
            HistoryKind::Files => self.files,
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            language: default_language(),
            max_history_count: DEFAULT_MAX_HISTORY_COUNT,
            enabled_history_types: HistoryTypes::default(),
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

fn default_language() -> AppLanguage {
    resolve_supported_language(&system_locale())
}

fn resolve_supported_language(locale: &str) -> AppLanguage {
    let normalized_locale = locale.to_lowercase();

    // 首次安装时只区分中文与其它语言；非中文环境统一回退英文。
    if normalized_locale.starts_with("zh") {
        AppLanguage::ZhCn
    } else {
        AppLanguage::En
    }
}

#[cfg(target_os = "windows")]
fn system_locale() -> String {
    const LOCALE_NAME_MAX_LENGTH: usize = 85;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        #[link_name = "GetUserDefaultLocaleName"]
        fn get_user_default_locale_name(name: *mut u16, name_count: i32) -> i32;
    }

    let mut locale_name = [0u16; LOCALE_NAME_MAX_LENGTH];
    let locale_length =
        unsafe { get_user_default_locale_name(locale_name.as_mut_ptr(), locale_name.len() as i32) };

    if locale_length > 0 {
        String::from_utf16_lossy(&locale_name[..locale_length as usize])
    } else {
        String::new()
    }
}

#[cfg(not(target_os = "windows"))]
fn system_locale() -> String {
    ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"]
        .iter()
        .find_map(|key| std::env::var(key).ok())
        .unwrap_or_default()
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
    // 保存偏好时同步外部副作用：启动项与历史条数裁剪必须和配置保持一致。
    sync_launch_at_login(app_handle, settings.launch_at_login)?;
    trim_history_to_max(app_handle, settings.max_history_count as usize)?;

    let path = settings_path(app_handle)?;
    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    write_text_atomically(&path, &content)?;

    let saved_settings = load_settings(app_handle)?;
    app_handle
        .emit(SETTINGS_UPDATED_EVENT, saved_settings.clone())
        .map_err(|error| error.to_string())?;

    Ok(saved_settings)
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
        // macOS 使用 LaunchAgent plist 实现登录启动。
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

            write_text_atomically(&plist_path, &plist_content)?;
        } else if plist_path.exists() {
            fs::remove_file(&plist_path).map_err(|error| error.to_string())?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 使用 Startup 目录下的 cmd 脚本实现登录启动。
        let startup_script_path = windows_startup_script_path(app_handle)?;

        if enabled {
            if let Some(parent) = startup_script_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }

            let executable = std::env::current_exe().map_err(|error| error.to_string())?;
            let script = windows_startup_script_contents(&executable);

            write_text_atomically(&startup_script_path, &script)?;
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
    use super::{
        resolve_supported_language, AppLanguage, AppSettings, HistoryTypes, MAX_MAX_HISTORY_COUNT,
        MIN_MAX_HISTORY_COUNT,
    };
    use crate::history::HistoryKind;

    #[test]
    fn sanitize_clamps_history_count_to_lower_bound() {
        let settings = AppSettings {
            launch_at_login: false,
            language: AppLanguage::En,
            max_history_count: 1,
            enabled_history_types: HistoryTypes::default(),
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MIN_MAX_HISTORY_COUNT);
    }

    #[test]
    fn sanitize_clamps_history_count_to_upper_bound() {
        let settings = AppSettings {
            launch_at_login: false,
            language: AppLanguage::En,
            max_history_count: 999,
            enabled_history_types: HistoryTypes::default(),
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MAX_MAX_HISTORY_COUNT);
    }

    #[test]
    fn resolve_supported_language_detects_chinese_locale() {
        assert_eq!(resolve_supported_language("zh-CN"), AppLanguage::ZhCn);
    }

    #[test]
    fn resolve_supported_language_falls_back_to_english() {
        assert_eq!(resolve_supported_language("tr-TR"), AppLanguage::En);
    }

    #[test]
    fn history_types_enable_all_types_by_default() {
        let types = HistoryTypes::default();

        assert!(types.is_enabled(HistoryKind::Text));
        assert!(types.is_enabled(HistoryKind::Url));
        assert!(types.is_enabled(HistoryKind::Image));
        assert!(types.is_enabled(HistoryKind::Files));
    }

    #[test]
    fn history_types_allow_all_types_to_be_disabled() {
        let types = HistoryTypes {
            text: false,
            url: false,
            image: false,
            files: false,
        };

        assert!(!types.is_enabled(HistoryKind::Text));
        assert!(!types.is_enabled(HistoryKind::Url));
        assert!(!types.is_enabled(HistoryKind::Image));
        assert!(!types.is_enabled(HistoryKind::Files));
    }
}
