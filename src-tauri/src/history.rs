use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager};

use crate::settings::load_settings;

pub const HISTORY_UPDATED_EVENT: &str = "history-updated";

#[tauri::command]
pub fn get_history(app_handle: AppHandle) -> Result<Vec<String>, String> {
    load_history(&app_handle)
}

#[tauri::command]
pub fn clear_history(app_handle: AppHandle) -> Result<(), String> {
    let path = history_path(&app_handle)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    emit_history_updated(&app_handle, &[])
}

pub fn process_new_history_item(
    app_handle: &AppHandle,
    new_item: &str,
) -> Result<Vec<String>, String> {
    let settings = load_settings(app_handle)?;
    let next_history = merge_history(
        load_history(app_handle)?,
        new_item.to_string(),
        settings.max_history_count as usize,
    );

    persist_history(app_handle, &next_history)?;

    Ok(next_history)
}

pub fn emit_history_updated(app_handle: &AppHandle, history: &[String]) -> Result<(), String> {
    app_handle
        .emit(HISTORY_UPDATED_EVENT, history.to_vec())
        .map_err(|error| error.to_string())
}

fn load_history(app_handle: &AppHandle) -> Result<Vec<String>, String> {
    let path = history_path(app_handle)?;

    if path.exists() {
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        serde_json::from_str::<Vec<String>>(&content).map_err(|error| error.to_string())
    } else {
        Ok(Vec::new())
    }
}

fn persist_history(app_handle: &AppHandle, history: &[String]) -> Result<(), String> {
    let path = history_path(app_handle)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn history_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(config_dir.join("history.json"))
}

fn merge_history(
    mut history: Vec<String>,
    new_item: String,
    max_history_count: usize,
) -> Vec<String> {
    history.retain(|item| item != &new_item);
    history.insert(0, new_item);

    if history.len() > max_history_count {
        history.truncate(max_history_count);
    }

    history
}

#[cfg(test)]
mod tests {
    use super::merge_history;

    #[test]
    fn merge_history_moves_existing_item_to_the_front() {
        let history = vec![
            "first".to_string(),
            "second".to_string(),
            "third".to_string(),
        ];
        let merged = merge_history(history, "second".to_string(), 10);

        assert_eq!(
            merged,
            vec![
                "second".to_string(),
                "first".to_string(),
                "third".to_string()
            ]
        );
    }

    #[test]
    fn merge_history_truncates_to_max_capacity() {
        let history = vec![
            "first".to_string(),
            "second".to_string(),
            "third".to_string(),
        ];
        let merged = merge_history(history, "latest".to_string(), 2);

        assert_eq!(merged, vec!["latest".to_string(), "first".to_string()]);
    }
}
