//! 剪贴板历史的读取、合并、裁剪和前端事件通知。

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use crate::settings::load_settings;
use crate::source_app::current_source_app_name;
use crate::storage::write_text_atomically;

pub const HISTORY_UPDATED_EVENT: &str = "history-updated";

#[derive(Debug, Clone, Copy, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HistoryKind {
    Text,
    Image,
    Files,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum HistoryEntry {
    Text {
        #[serde(flatten)]
        common: HistoryEntryCommon,
        text: String,
    },
    Image {
        #[serde(flatten)]
        common: HistoryEntryCommon,
        #[serde(rename = "imagePath", alias = "image_path")]
        image_path: String,
        width: u32,
        height: u32,
        #[serde(rename = "byteSize", alias = "byte_size")]
        byte_size: u64,
        #[serde(rename = "contentHash", alias = "content_hash")]
        content_hash: String,
    },
    Files {
        #[serde(flatten)]
        common: HistoryEntryCommon,
        #[serde(rename = "filePaths", alias = "file_paths")]
        file_paths: Vec<String>,
    },
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntryCommon {
    pub id: String,
    pub display_text: String,
    pub first_copied_at: u64,
    pub last_copied_at: u64,
    pub source_app: Option<String>,
    pub copy_count: u32,
}

pub enum NewHistoryItem {
    Text(String),
    Image {
        png_bytes: Vec<u8>,
        width: u32,
        height: u32,
        content_hash: String,
    },
    Files(Vec<String>),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyTextHistoryEntry {
    text: String,
    first_copied_at: u64,
    last_copied_at: u64,
    source_app: Option<String>,
    copy_count: u32,
}

impl HistoryEntry {
    pub fn id(&self) -> &str {
        &self.common().id
    }

    pub fn common(&self) -> &HistoryEntryCommon {
        match self {
            HistoryEntry::Text { common, .. }
            | HistoryEntry::Image { common, .. }
            | HistoryEntry::Files { common, .. } => common,
        }
    }

    fn common_mut(&mut self) -> &mut HistoryEntryCommon {
        match self {
            HistoryEntry::Text { common, .. }
            | HistoryEntry::Image { common, .. }
            | HistoryEntry::Files { common, .. } => common,
        }
    }

    fn image_path(&self) -> Option<&str> {
        match self {
            HistoryEntry::Image { image_path, .. } => Some(image_path),
            _ => None,
        }
    }
}

impl NewHistoryItem {
    pub fn kind(&self) -> HistoryKind {
        match self {
            NewHistoryItem::Text(_) => HistoryKind::Text,
            NewHistoryItem::Image { .. } => HistoryKind::Image,
            NewHistoryItem::Files(_) => HistoryKind::Files,
        }
    }

    pub fn dedupe_key(&self) -> String {
        match self {
            NewHistoryItem::Text(text) => format!("text:{text}"),
            NewHistoryItem::Image { content_hash, .. } => format!("image:{content_hash}"),
            NewHistoryItem::Files(file_paths) => format!("files:{}", file_paths.join("\n")),
        }
    }
}

#[tauri::command]
pub fn get_history(app_handle: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    load_history(&app_handle)
}

#[tauri::command]
pub fn clear_history(app_handle: AppHandle) -> Result<(), String> {
    let path = history_path(&app_handle)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    remove_history_assets(&app_handle)?;
    emit_history_updated(&app_handle, &[])
}

#[tauri::command]
pub fn delete_history_item(app_handle: AppHandle, id: String) -> Result<Vec<HistoryEntry>, String> {
    let current_history = load_history(&app_handle)?;
    let (next_history, did_delete) = remove_history_item(current_history, &id);

    if !did_delete {
        return Ok(next_history);
    }

    if next_history.is_empty() {
        let path = history_path(&app_handle)?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    } else {
        persist_history(&app_handle, &next_history)?;
    }

    cleanup_unused_image_assets(&app_handle, &next_history)?;
    emit_history_updated(&app_handle, &next_history)?;
    Ok(next_history)
}

pub fn find_history_item(app_handle: &AppHandle, id: &str) -> Result<Option<HistoryEntry>, String> {
    Ok(load_history(app_handle)?
        .into_iter()
        .find(|item| item.id() == id))
}

pub fn process_new_history_item(
    app_handle: &AppHandle,
    new_item: NewHistoryItem,
) -> Result<Option<Vec<HistoryEntry>>, String> {
    let settings = load_settings(app_handle)?;

    if !settings.enabled_history_types.is_enabled(new_item.kind()) {
        return Ok(None);
    }

    let copied_at = current_timestamp_millis();
    let source_app = current_source_app_name();
    let new_entry = create_history_entry(app_handle, new_item, copied_at, source_app)?;
    let next_history = merge_history(
        load_history(app_handle)?,
        new_entry,
        settings.max_history_count as usize,
    );

    persist_history(app_handle, &next_history)?;
    cleanup_unused_image_assets(app_handle, &next_history)?;

    Ok(Some(next_history))
}

pub fn trim_history_to_max(app_handle: &AppHandle, max_history_count: usize) -> Result<(), String> {
    let mut history = load_history(app_handle)?;

    if history.len() <= max_history_count {
        return Ok(());
    }

    history.truncate(max_history_count);
    persist_history(app_handle, &history)?;
    cleanup_unused_image_assets(app_handle, &history)?;
    emit_history_updated(app_handle, &history)
}

pub fn emit_history_updated(
    app_handle: &AppHandle,
    history: &[HistoryEntry],
) -> Result<(), String> {
    app_handle
        .emit(HISTORY_UPDATED_EVENT, history.to_vec())
        .map_err(|error| error.to_string())
}

pub fn load_history(app_handle: &AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let path = history_path(app_handle)?;

    if path.exists() {
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        if let Ok(history) = serde_json::from_str::<Vec<HistoryEntry>>(&content) {
            return Ok(history);
        }

        if let Ok(legacy_history) = serde_json::from_str::<Vec<LegacyTextHistoryEntry>>(&content) {
            return Ok(migrate_structured_text_history(legacy_history));
        }

        match serde_json::from_str::<Vec<String>>(&content) {
            Ok(legacy_history) => Ok(migrate_legacy_text_history(
                legacy_history,
                current_timestamp_millis(),
            )),
            Err(error) => {
                // 历史文件损坏不能影响应用启动；回退为空历史即可。
                eprintln!("failed to parse clipboard history, using empty history: {error}");
                Ok(Vec::new())
            }
        }
    } else {
        Ok(Vec::new())
    }
}

fn persist_history(app_handle: &AppHandle, history: &[HistoryEntry]) -> Result<(), String> {
    let path = history_path(app_handle)?;
    let content = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;
    write_text_atomically(&path, &content)
}

fn history_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(config_dir.join("history.json"))
}

fn image_assets_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(config_dir.join("history-assets").join("images"))
}

fn image_asset_path(app_handle: &AppHandle, content_hash: &str) -> Result<PathBuf, String> {
    Ok(image_assets_dir(app_handle)?.join(format!("{content_hash}.png")))
}

fn create_history_entry(
    app_handle: &AppHandle,
    item: NewHistoryItem,
    copied_at: u64,
    source_app: Option<String>,
) -> Result<HistoryEntry, String> {
    let id = history_id(&item.dedupe_key());

    match item {
        NewHistoryItem::Text(text) => {
            Ok(create_text_entry(text, copied_at, copied_at, source_app, 1))
        }
        NewHistoryItem::Image {
            png_bytes,
            width,
            height,
            content_hash,
        } => {
            let image_path = image_asset_path(app_handle, &content_hash)?;
            if let Some(parent) = image_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&image_path, &png_bytes).map_err(|error| error.to_string())?;

            Ok(HistoryEntry::Image {
                common: HistoryEntryCommon {
                    id,
                    display_text: format!("Image {width}x{height}"),
                    first_copied_at: copied_at,
                    last_copied_at: copied_at,
                    source_app,
                    copy_count: 1,
                },
                image_path: image_path.to_string_lossy().into_owned(),
                width,
                height,
                byte_size: png_bytes.len() as u64,
                content_hash,
            })
        }
        NewHistoryItem::Files(file_paths) => Ok(HistoryEntry::Files {
            common: HistoryEntryCommon {
                id,
                display_text: files_display_text(&file_paths),
                first_copied_at: copied_at,
                last_copied_at: copied_at,
                source_app,
                copy_count: 1,
            },
            file_paths,
        }),
    }
}

fn merge_history(
    mut history: Vec<HistoryEntry>,
    mut new_item: HistoryEntry,
    max_history_count: usize,
) -> Vec<HistoryEntry> {
    if let Some(existing_item) = history.iter().find(|item| item.id() == new_item.id()) {
        let existing_common = existing_item.common();
        let new_common = new_item.common_mut();
        new_common.first_copied_at = existing_common.first_copied_at;
        new_common.copy_count = existing_common.copy_count.saturating_add(1);
    }

    let new_item_id = new_item.id().to_string();
    history.retain(|item| item.id() != new_item_id);
    history.insert(0, new_item);

    if history.len() > max_history_count {
        history.truncate(max_history_count);
    }

    history
}

fn remove_history_item(mut history: Vec<HistoryEntry>, id: &str) -> (Vec<HistoryEntry>, bool) {
    let original_len = history.len();
    history.retain(|item| item.id() != id);

    let did_delete = history.len() != original_len;
    (history, did_delete)
}

fn create_text_entry(
    text: String,
    first_copied_at: u64,
    last_copied_at: u64,
    source_app: Option<String>,
    copy_count: u32,
) -> HistoryEntry {
    let id = history_id(&format!("text:{text}"));

    HistoryEntry::Text {
        common: HistoryEntryCommon {
            id,
            display_text: text.clone(),
            first_copied_at,
            last_copied_at,
            source_app,
            copy_count,
        },
        text,
    }
}

fn migrate_structured_text_history(history: Vec<LegacyTextHistoryEntry>) -> Vec<HistoryEntry> {
    history
        .into_iter()
        .map(|entry| {
            create_text_entry(
                entry.text,
                entry.first_copied_at,
                entry.last_copied_at,
                entry.source_app,
                entry.copy_count,
            )
        })
        .collect()
}

fn migrate_legacy_text_history(history: Vec<String>, copied_at: u64) -> Vec<HistoryEntry> {
    history
        .into_iter()
        .map(|text| create_text_entry(text, copied_at, copied_at, None, 1))
        .collect()
}

fn cleanup_unused_image_assets(
    app_handle: &AppHandle,
    history: &[HistoryEntry],
) -> Result<(), String> {
    let image_dir = image_assets_dir(app_handle)?;

    if !image_dir.exists() {
        return Ok(());
    }

    let used_paths: HashSet<PathBuf> = history
        .iter()
        .filter_map(|item| item.image_path().map(PathBuf::from))
        .collect();

    for entry in fs::read_dir(&image_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|extension| extension.to_str()) == Some("png")
            && !used_paths.contains(&path)
        {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn remove_history_assets(app_handle: &AppHandle) -> Result<(), String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    let assets_dir = config_dir.join("history-assets");

    if assets_dir.exists() {
        fs::remove_dir_all(assets_dir).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn files_display_text(file_paths: &[String]) -> String {
    let Some(first_path) = file_paths.first() else {
        return "Files".to_string();
    };
    let first_name = Path::new(first_path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(first_path);

    if file_paths.len() > 1 {
        format!("{first_name} +{}", file_paths.len() - 1)
    } else {
        first_name.to_string()
    }
}

fn history_id(dedupe_key: &str) -> String {
    format!("h_{}", hash_hex(dedupe_key.as_bytes()))
}

pub fn hash_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn current_timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{
        create_text_entry, files_display_text, hash_hex, merge_history,
        migrate_legacy_text_history, migrate_structured_text_history, remove_history_item,
        HistoryEntry, HistoryKind, LegacyTextHistoryEntry, NewHistoryItem,
    };

    fn text_entry(text: &str, copied_at: u64, source_app: Option<&str>) -> HistoryEntry {
        create_text_entry(
            text.to_string(),
            copied_at,
            copied_at,
            source_app.map(str::to_string),
            1,
        )
    }

    #[test]
    fn new_history_item_reports_expected_kinds() {
        assert_eq!(
            NewHistoryItem::Text("a".to_string()).kind(),
            HistoryKind::Text
        );
        assert_eq!(
            NewHistoryItem::Image {
                png_bytes: vec![],
                width: 1,
                height: 1,
                content_hash: "hash".to_string(),
            }
            .kind(),
            HistoryKind::Image
        );
        assert_eq!(
            NewHistoryItem::Files(vec!["/tmp/a.txt".to_string()]).kind(),
            HistoryKind::Files
        );
    }

    #[test]
    fn merge_history_moves_existing_item_to_the_front() {
        let history = vec![
            text_entry("first", 1000, Some("Notes")),
            text_entry("second", 2000, Some("Code")),
            text_entry("third", 3000, None),
        ];
        let mut new_entry = text_entry("second", 4000, Some("Safari"));
        new_entry.common_mut().last_copied_at = 4000;

        let merged = merge_history(history, new_entry, 10);

        assert_eq!(merged[0].common().display_text, "second");
        assert_eq!(merged[0].common().first_copied_at, 2000);
        assert_eq!(merged[0].common().last_copied_at, 4000);
        assert_eq!(merged[0].common().source_app.as_deref(), Some("Safari"));
        assert_eq!(merged[0].common().copy_count, 2);
        assert_eq!(merged[1].common().display_text, "first");
        assert_eq!(merged[2].common().display_text, "third");
    }

    #[test]
    fn merge_history_truncates_to_max_capacity() {
        let history = vec![
            text_entry("first", 1000, None),
            text_entry("second", 2000, None),
            text_entry("third", 3000, None),
        ];
        let merged = merge_history(history, text_entry("latest", 4000, None), 2);

        assert_eq!(merged[0].common().display_text, "latest");
        assert_eq!(merged[1].common().display_text, "first");
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn remove_history_item_removes_matching_item_and_keeps_order() {
        let history = vec![
            text_entry("first", 1000, None),
            text_entry("second", 2000, None),
            text_entry("third", 3000, None),
        ];
        let second_id = history[1].id().to_string();
        let (next_history, did_delete) = remove_history_item(history, &second_id);

        assert!(did_delete);
        assert_eq!(next_history[0].common().display_text, "first");
        assert_eq!(next_history[1].common().display_text, "third");
    }

    #[test]
    fn remove_history_item_keeps_history_when_item_is_missing() {
        let history = vec![
            text_entry("first", 1000, None),
            text_entry("second", 2000, None),
        ];
        let (next_history, did_delete) = remove_history_item(history, "missing");

        assert!(!did_delete);
        assert_eq!(next_history.len(), 2);
    }

    #[test]
    fn migrates_legacy_string_history_to_text_entries() {
        let migrated = migrate_legacy_text_history(vec!["hello".to_string()], 1234);

        assert!(matches!(migrated[0], HistoryEntry::Text { .. }));
        assert_eq!(migrated[0].common().display_text, "hello");
        assert_eq!(migrated[0].common().first_copied_at, 1234);
        assert_eq!(migrated[0].common().copy_count, 1);
    }

    #[test]
    fn migrates_structured_text_history_to_text_entries() {
        let migrated = migrate_structured_text_history(vec![LegacyTextHistoryEntry {
            text: "hello".to_string(),
            first_copied_at: 100,
            last_copied_at: 200,
            source_app: Some("Notes".to_string()),
            copy_count: 3,
        }]);

        assert!(matches!(migrated[0], HistoryEntry::Text { .. }));
        assert_eq!(migrated[0].common().display_text, "hello");
        assert_eq!(migrated[0].common().last_copied_at, 200);
        assert_eq!(migrated[0].common().source_app.as_deref(), Some("Notes"));
        assert_eq!(migrated[0].common().copy_count, 3);
    }

    #[test]
    fn files_display_text_uses_first_file_name_and_count() {
        assert_eq!(
            files_display_text(&["/tmp/report.pdf".to_string(), "/tmp/notes.txt".to_string()]),
            "report.pdf +1"
        );
    }

    #[test]
    fn file_history_entries_serialize_frontend_field_names() {
        let entry = HistoryEntry::Files {
            common: super::HistoryEntryCommon {
                id: "h_files".to_string(),
                display_text: "note.txt".to_string(),
                first_copied_at: 100,
                last_copied_at: 200,
                source_app: None,
                copy_count: 1,
            },
            file_paths: vec!["/tmp/note.txt".to_string()],
        };

        let json = serde_json::to_value(entry).unwrap();

        assert!(json.get("filePaths").is_some());
        assert!(json.get("file_paths").is_none());
    }

    #[test]
    fn image_history_entries_serialize_frontend_field_names() {
        let entry = HistoryEntry::Image {
            common: super::HistoryEntryCommon {
                id: "h_image".to_string(),
                display_text: "Image 1x1".to_string(),
                first_copied_at: 100,
                last_copied_at: 200,
                source_app: None,
                copy_count: 1,
            },
            image_path: "/tmp/image.png".to_string(),
            width: 1,
            height: 1,
            byte_size: 42,
            content_hash: "hash".to_string(),
        };

        let json = serde_json::to_value(entry).unwrap();

        assert!(json.get("imagePath").is_some());
        assert!(json.get("byteSize").is_some());
        assert!(json.get("contentHash").is_some());
        assert!(json.get("image_path").is_none());
        assert!(json.get("byte_size").is_none());
        assert!(json.get("content_hash").is_none());
    }

    #[test]
    fn file_history_entries_deserialize_legacy_snake_case_field_names() {
        let json = serde_json::json!({
            "kind": "files",
            "id": "h_files",
            "displayText": "note.txt",
            "firstCopiedAt": 100,
            "lastCopiedAt": 200,
            "sourceApp": null,
            "copyCount": 1,
            "file_paths": ["/tmp/note.txt"],
        });

        let entry: HistoryEntry = serde_json::from_value(json).unwrap();

        match entry {
            HistoryEntry::Files { file_paths, .. } => {
                assert_eq!(file_paths, vec!["/tmp/note.txt".to_string()]);
            }
            _ => panic!("expected files entry"),
        }
    }

    #[test]
    fn hash_hex_is_stable_sha256() {
        assert_eq!(
            hash_hex(b"mclip"),
            "3983158eb7199a0eddb1a5733d2323bd825448f3d16533bfa7a1c5328631e603"
        );
    }
}
