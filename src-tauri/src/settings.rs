//! 应用偏好设置。
//! 负责语言、历史条数、登录启动等配置的持久化，并同步平台启动项。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::desktop_state::DesktopStateRepository;
use crate::history::{trim_history_to_max, HistoryKind};
use crate::performance::performance_config_dir_override;
use crate::storage::{write_text_atomically, write_text_atomically_if_changed};

pub const DEFAULT_MAX_HISTORY_COUNT: u32 = 200;
pub const MIN_MAX_HISTORY_COUNT: u32 = 10;
pub const MAX_MAX_HISTORY_COUNT: u32 = 500;
pub const DEFAULT_VISIBLE_ITEM_COUNT: u32 = 10;
pub const MIN_VISIBLE_ITEM_COUNT: u32 = 5;
pub const MAX_VISIBLE_ITEM_COUNT: u32 = 20;
pub const SETTINGS_UPDATED_EVENT: &str = "settings-updated";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppLanguage {
    #[default]
    System,
    ZhCn,
    En,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolvedAppLanguage {
    ZhCn,
    En,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MenuBarIconStyle {
    AppIcon,
    #[default]
    Light,
    M,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppearanceTheme {
    Light,
    Dark,
    #[default]
    #[serde(other)]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub auto_paste: bool,
    pub launch_at_login: bool,
    #[serde(default = "default_language")]
    pub language: AppLanguage,
    pub max_history_count: u32,
    #[serde(default)]
    pub enabled_history_types: HistoryTypes,
    #[serde(default)]
    pub menu_bar_icon_style: MenuBarIconStyle,
    #[serde(default = "default_visible_item_count")]
    pub main_window_item_count: u32,
    #[serde(default = "default_visible_item_count")]
    pub history_group_item_count: u32,
    #[serde(default = "default_show_history_item_numbers")]
    pub show_history_item_numbers: bool,
    #[serde(default = "default_show_main_window_brand")]
    pub show_main_window_brand: bool,
    #[serde(default)]
    pub appearance_theme: AppearanceTheme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryTypes {
    pub text: bool,
    pub image: bool,
    pub files: bool,
}

impl Default for HistoryTypes {
    fn default() -> Self {
        Self {
            text: true,
            image: true,
            files: true,
        }
    }
}

impl HistoryTypes {
    pub fn is_enabled(&self, kind: HistoryKind) -> bool {
        match kind {
            HistoryKind::Text => self.text,
            HistoryKind::Image => self.image,
            HistoryKind::Files => self.files,
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_paste: false,
            launch_at_login: false,
            language: default_language(),
            max_history_count: DEFAULT_MAX_HISTORY_COUNT,
            enabled_history_types: HistoryTypes::default(),
            menu_bar_icon_style: MenuBarIconStyle::default(),
            main_window_item_count: DEFAULT_VISIBLE_ITEM_COUNT,
            history_group_item_count: DEFAULT_VISIBLE_ITEM_COUNT,
            show_history_item_numbers: true,
            show_main_window_brand: true,
            appearance_theme: AppearanceTheme::default(),
        }
    }
}

impl AppSettings {
    pub fn sanitize(mut self) -> Self {
        self.max_history_count = self
            .max_history_count
            .clamp(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT);
        self.main_window_item_count = self
            .main_window_item_count
            .clamp(MIN_VISIBLE_ITEM_COUNT, self.max_history_count);
        self.history_group_item_count = self
            .history_group_item_count
            .clamp(MIN_VISIBLE_ITEM_COUNT, MAX_VISIBLE_ITEM_COUNT);
        self
    }
}

fn default_visible_item_count() -> u32 {
    DEFAULT_VISIBLE_ITEM_COUNT
}

fn default_show_history_item_numbers() -> bool {
    true
}

fn default_show_main_window_brand() -> bool {
    true
}

fn default_language() -> AppLanguage {
    AppLanguage::System
}

fn resolve_supported_language(locale: &str) -> ResolvedAppLanguage {
    let normalized_locale = locale.to_lowercase();

    if normalized_locale.starts_with("zh") {
        ResolvedAppLanguage::ZhCn
    } else {
        ResolvedAppLanguage::En
    }
}

pub fn resolve_app_language(language: &AppLanguage) -> ResolvedAppLanguage {
    match language {
        AppLanguage::System => resolve_supported_language(&system_locale()),
        AppLanguage::ZhCn => ResolvedAppLanguage::ZhCn,
        AppLanguage::En => ResolvedAppLanguage::En,
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
pub async fn get_settings(app_handle: AppHandle) -> Result<AppSettings, String> {
    let repository = app_handle.state::<DesktopStateRepository>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || repository.settings())
        .await
        .map_err(|error| error.to_string())?
}

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

    let saved_settings = app_handle
        .state::<DesktopStateRepository>()
        .commit_settings(settings)?;
    app_handle
        .emit(SETTINGS_UPDATED_EVENT, saved_settings.clone())
        .map_err(|error| error.to_string())?;

    Ok(saved_settings)
}

pub(crate) fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    if let Some(config_dir) = performance_config_dir_override()? {
        return Ok(config_dir.join("settings.json"));
    }

    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("MCLIP_APP_CONFIG_DIR") {
        return Ok(PathBuf::from(path).join("settings.json"));
    }

    app_handle
        .path()
        .app_config_dir()
        .map(|config_dir| config_dir.join("settings.json"))
        .map_err(|error| error.to_string())
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

            write_text_atomically_if_changed(&plist_path, &plist_content)?;
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

            write_text_atomically_if_changed(&startup_script_path, &script)?;
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
        resolve_app_language, resolve_supported_language, AppLanguage, AppSettings,
        AppearanceTheme, HistoryTypes, ResolvedAppLanguage, DEFAULT_MAX_HISTORY_COUNT,
        DEFAULT_VISIBLE_ITEM_COUNT, MAX_MAX_HISTORY_COUNT, MAX_VISIBLE_ITEM_COUNT,
        MIN_MAX_HISTORY_COUNT, MIN_VISIBLE_ITEM_COUNT,
    };
    use crate::history::HistoryKind;

    #[test]
    fn history_count_defaults_to_200_with_a_500_entry_upper_bound() {
        assert_eq!(DEFAULT_MAX_HISTORY_COUNT, 200);
        assert_eq!(MAX_MAX_HISTORY_COUNT, 500);
        assert_eq!(AppSettings::default().max_history_count, 200);
    }

    #[test]
    fn sanitize_clamps_history_count_to_lower_bound() {
        let settings = AppSettings {
            max_history_count: 1,
            ..AppSettings::default()
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MIN_MAX_HISTORY_COUNT);
    }

    #[test]
    fn sanitize_clamps_history_count_to_upper_bound() {
        let settings = AppSettings {
            max_history_count: 999,
            ..AppSettings::default()
        }
        .sanitize();

        assert_eq!(settings.max_history_count, MAX_MAX_HISTORY_COUNT);
    }

    #[test]
    fn resolve_supported_language_detects_chinese_locale() {
        assert_eq!(
            resolve_supported_language("zh-CN"),
            ResolvedAppLanguage::ZhCn
        );
    }

    #[test]
    fn resolve_supported_language_detects_english_locale() {
        assert_eq!(resolve_supported_language("en-US"), ResolvedAppLanguage::En);
    }

    #[test]
    fn resolve_supported_language_falls_back_to_english() {
        assert_eq!(resolve_supported_language("tr-TR"), ResolvedAppLanguage::En);
    }

    #[test]
    fn resolve_app_language_preserves_explicit_language() {
        assert_eq!(
            resolve_app_language(&AppLanguage::ZhCn),
            ResolvedAppLanguage::ZhCn
        );
        assert_eq!(
            resolve_app_language(&AppLanguage::En),
            ResolvedAppLanguage::En
        );
    }

    #[test]
    fn history_types_enable_all_types_by_default() {
        let types = HistoryTypes::default();

        assert!(types.is_enabled(HistoryKind::Text));
        assert!(types.is_enabled(HistoryKind::Image));
        assert!(types.is_enabled(HistoryKind::Files));
    }

    #[test]
    fn history_types_allow_all_types_to_be_disabled() {
        let types = HistoryTypes {
            text: false,
            image: false,
            files: false,
        };

        assert!(!types.is_enabled(HistoryKind::Text));
        assert!(!types.is_enabled(HistoryKind::Image));
        assert!(!types.is_enabled(HistoryKind::Files));
    }

    #[test]
    fn auto_paste_is_disabled_by_default() {
        assert!(!AppSettings::default().auto_paste);
    }

    #[test]
    fn default_settings_use_light_menu_bar_style() {
        let value = serde_json::to_value(AppSettings::default()).unwrap();

        assert_eq!(value["menuBarIconStyle"].as_str(), Some("light"));
    }

    #[test]
    fn default_settings_follow_system_language() {
        let value = serde_json::to_value(AppSettings::default()).unwrap();

        assert_eq!(value["language"].as_str(), Some("system"));
    }

    #[test]
    fn default_settings_include_display_preferences() {
        let value = serde_json::to_value(AppSettings::default()).unwrap();

        assert_eq!(value["mainWindowItemCount"].as_u64(), Some(10));
        assert_eq!(value["historyGroupItemCount"].as_u64(), Some(10));
        assert_eq!(value["showHistoryItemNumbers"].as_bool(), Some(true));
        assert_eq!(value["appearanceTheme"].as_str(), Some("system"));
        assert_eq!(value["showMainWindowBrand"].as_bool(), Some(true));
    }

    #[test]
    fn sanitize_clamps_visible_item_counts() {
        let settings = AppSettings {
            main_window_item_count: 1,
            history_group_item_count: 999,
            ..AppSettings::default()
        }
        .sanitize();

        assert_eq!(settings.main_window_item_count, MIN_VISIBLE_ITEM_COUNT);
        assert_eq!(settings.history_group_item_count, MAX_VISIBLE_ITEM_COUNT);
    }

    #[test]
    fn sanitize_allows_main_window_item_count_up_to_max_history_count() {
        let settings = AppSettings {
            max_history_count: 80,
            main_window_item_count: 80,
            history_group_item_count: 999,
            ..AppSettings::default()
        }
        .sanitize();

        assert_eq!(settings.main_window_item_count, 80);
        assert_eq!(settings.history_group_item_count, MAX_VISIBLE_ITEM_COUNT);
    }

    #[test]
    fn sanitize_reconciles_main_window_item_count_when_history_max_is_lowered() {
        let settings = AppSettings {
            max_history_count: 50,
            main_window_item_count: 80,
            ..AppSettings::default()
        }
        .sanitize();

        assert_eq!(settings.max_history_count, 50);
        assert_eq!(settings.main_window_item_count, 50);
    }

    #[test]
    fn legacy_settings_without_display_preferences_use_defaults() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "appIcon"
            }"#,
        )
        .unwrap();

        assert_eq!(settings.main_window_item_count, DEFAULT_VISIBLE_ITEM_COUNT);
        assert_eq!(
            settings.history_group_item_count,
            DEFAULT_VISIBLE_ITEM_COUNT
        );
        assert!(settings.show_history_item_numbers);
        assert_eq!(settings.appearance_theme, AppearanceTheme::System);
        let value = serde_json::to_value(settings).unwrap();

        assert_eq!(value["showMainWindowBrand"].as_bool(), Some(true));
    }

    #[test]
    fn settings_preserve_disabled_main_window_brand_visibility() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "appIcon",
              "showMainWindowBrand": false
            }"#,
        )
        .unwrap();
        let value = serde_json::to_value(settings).unwrap();

        assert_eq!(value["showMainWindowBrand"].as_bool(), Some(false));
    }

    #[test]
    fn unknown_appearance_theme_deserializes_to_system() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "appIcon",
              "appearanceTheme": "sepia"
            }"#,
        )
        .unwrap();

        assert_eq!(settings.appearance_theme, AppearanceTheme::System);
    }

    #[test]
    fn settings_deserialize_light_menu_bar_icon_style() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "light"
            }"#,
        )
        .unwrap();
        let value = serde_json::to_value(settings).unwrap();

        assert_eq!(value["menuBarIconStyle"].as_str(), Some("light"));
    }

    #[test]
    fn settings_deserialize_m_menu_bar_icon_style() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "m"
            }"#,
        )
        .unwrap();
        let value = serde_json::to_value(settings).unwrap();

        assert_eq!(value["menuBarIconStyle"].as_str(), Some("m"));
    }

    #[test]
    fn settings_deserialize_system_language() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "autoPaste": false,
              "launchAtLogin": false,
              "language": "system",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              },
              "menuBarIconStyle": "light"
            }"#,
        )
        .unwrap();
        let value = serde_json::to_value(settings).unwrap();

        assert_eq!(value["language"].as_str(), Some("system"));
    }

    #[test]
    fn legacy_settings_without_auto_paste_default_to_disabled() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "launchAtLogin": false,
              "language": "en",
              "maxHistoryCount": 50,
              "enabledHistoryTypes": {
                "text": true,
                "image": true,
                "files": true
              }
            }"#,
        )
        .unwrap();

        assert!(!settings.auto_paste);
    }
}
