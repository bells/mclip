//! 剪贴板历史的读取、合并、裁剪和前端事件通知。

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use crate::desktop_state::{
    DesktopHistoryMutation, DesktopHistorySnapshot, DesktopStateRepository,
};
use crate::performance::performance_config_dir_override;
use crate::source_app::current_source_app_name;
use crate::storage::write_text_atomically;

pub const HISTORY_CHANGED_EVENT: &str = "history-changed";
pub const HISTORY_PREVIEW_INVALIDATED_EVENT: &str = "history-preview-invalidated";
const MAIN_WINDOW_LABEL: &str = "main";
const PREVIEW_WINDOW_LABEL: &str = "preview";

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

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySnapshot {
    pub entries: Vec<HistoryEntry>,
    pub revision: u64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum HistoryChange {
    Replace {
        base_revision: u64,
        revision: u64,
        entries: Vec<HistoryEntry>,
    },
    Upsert {
        base_revision: u64,
        revision: u64,
        entry: HistoryEntry,
        removed_ids: Vec<String>,
    },
    Remove {
        base_revision: u64,
        revision: u64,
        removed_ids: Vec<String>,
    },
    Clear {
        base_revision: u64,
        revision: u64,
    },
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum HistoryPreviewInvalidation {
    Replace {
        base_revision: u64,
        revision: u64,
        close_current_preview: bool,
    },
    Upsert {
        base_revision: u64,
        revision: u64,
        removed_ids: Vec<String>,
        close_current_preview: bool,
    },
    Remove {
        base_revision: u64,
        revision: u64,
        removed_ids: Vec<String>,
        close_current_preview: bool,
    },
    Clear {
        base_revision: u64,
        revision: u64,
        close_current_preview: bool,
    },
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

#[derive(Debug, Clone, PartialEq)]
pub struct HistoryMutationResult {
    pub history: Vec<HistoryEntry>,
    pub changed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryFileFingerprint {
    pub exists: bool,
    pub byte_len: u64,
    pub content_hash: Option<String>,
}

impl HistoryFileFingerprint {
    fn missing() -> Self {
        Self {
            exists: false,
            byte_len: 0,
            content_hash: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct LoadedHistoryFile {
    pub history: Vec<HistoryEntry>,
    pub fingerprint: HistoryFileFingerprint,
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

    pub(crate) fn image_path(&self) -> Option<&str> {
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
pub async fn get_history_snapshot(app_handle: AppHandle) -> Result<HistorySnapshot, String> {
    let repository = app_handle.state::<DesktopStateRepository>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || repository.history_snapshot())
        .await
        .map_err(|error| error.to_string())?
        .map(HistorySnapshot::from)
}

#[tauri::command]
pub async fn clear_history(app_handle: AppHandle) -> Result<Option<HistoryChange>, String> {
    let repository = app_handle.state::<DesktopStateRepository>().inner().clone();
    let mutation = tauri::async_runtime::spawn_blocking(move || repository.clear_history())
        .await
        .map_err(|error| error.to_string())??;
    let change = history_change_for_clear(&mutation);
    if let Some(change) = &change {
        emit_history_change(&app_handle, change)?;
    }
    Ok(change)
}

#[tauri::command]
pub async fn delete_history_item(
    app_handle: AppHandle,
    id: String,
) -> Result<Option<HistoryChange>, String> {
    let repository = app_handle.state::<DesktopStateRepository>().inner().clone();
    let mutation =
        tauri::async_runtime::spawn_blocking(move || repository.delete_history_item(&id))
            .await
            .map_err(|error| error.to_string())??;
    let change = history_change_for_remove(&mutation);
    if let Some(change) = &change {
        emit_history_change(&app_handle, change)?;
    }
    Ok(change)
}

pub fn process_new_history_item(
    app_handle: &AppHandle,
    new_item: NewHistoryItem,
) -> Result<Option<HistoryChange>, String> {
    let repository = app_handle.state::<DesktopStateRepository>();
    let settings = repository.settings()?;

    if !settings.enabled_history_types.is_enabled(new_item.kind()) {
        return Ok(None);
    }

    let copied_at = current_timestamp_millis();
    let source_app = current_source_app_name();
    let new_entry = create_history_entry(app_handle, new_item, copied_at, source_app)?;
    let mutation =
        repository.merge_history_entry(new_entry, settings.max_history_count as usize)?;

    Ok(history_change_for_upsert(&mutation))
}

pub fn trim_history_to_max(app_handle: &AppHandle, max_history_count: usize) -> Result<(), String> {
    let mutation = app_handle
        .state::<DesktopStateRepository>()
        .trim_history(max_history_count)?;
    if let Some(change) = history_change_for_remove(&mutation) {
        emit_history_change(app_handle, &change)?;
    }
    Ok(())
}

pub fn emit_history_change(app_handle: &AppHandle, change: &HistoryChange) -> Result<(), String> {
    app_handle
        .emit_to(MAIN_WINDOW_LABEL, HISTORY_CHANGED_EVENT, change)
        .map_err(|error| error.to_string())?;

    if app_handle
        .get_webview_window(PREVIEW_WINDOW_LABEL)
        .is_some()
    {
        app_handle
            .emit_to(
                PREVIEW_WINDOW_LABEL,
                HISTORY_PREVIEW_INVALIDATED_EVENT,
                HistoryPreviewInvalidation::from(change),
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

impl From<DesktopHistorySnapshot> for HistorySnapshot {
    fn from(snapshot: DesktopHistorySnapshot) -> Self {
        Self {
            entries: snapshot.history,
            revision: snapshot.revision,
        }
    }
}

impl From<&HistoryChange> for HistoryPreviewInvalidation {
    fn from(change: &HistoryChange) -> Self {
        match change {
            HistoryChange::Replace {
                base_revision,
                revision,
                ..
            } => Self::Replace {
                base_revision: *base_revision,
                revision: *revision,
                close_current_preview: true,
            },
            HistoryChange::Upsert {
                base_revision,
                revision,
                removed_ids,
                ..
            } => Self::Upsert {
                base_revision: *base_revision,
                revision: *revision,
                removed_ids: removed_ids.clone(),
                close_current_preview: true,
            },
            HistoryChange::Remove {
                base_revision,
                revision,
                removed_ids,
            } => Self::Remove {
                base_revision: *base_revision,
                revision: *revision,
                removed_ids: removed_ids.clone(),
                close_current_preview: false,
            },
            HistoryChange::Clear {
                base_revision,
                revision,
            } => Self::Clear {
                base_revision: *base_revision,
                revision: *revision,
                close_current_preview: true,
            },
        }
    }
}

fn history_change_for_upsert(mutation: &DesktopHistoryMutation) -> Option<HistoryChange> {
    history_replace_for_external_reload(mutation).or_else(|| {
        let entry = mutation.snapshot.history.first()?.clone();
        Some(HistoryChange::Upsert {
            base_revision: mutation.previous_snapshot.revision,
            revision: mutation.snapshot.revision,
            entry,
            removed_ids: removed_history_ids(mutation),
        })
    })
}

fn history_change_for_remove(mutation: &DesktopHistoryMutation) -> Option<HistoryChange> {
    history_replace_for_external_reload(mutation).or_else(|| {
        mutation.changed.then(|| HistoryChange::Remove {
            base_revision: mutation.previous_snapshot.revision,
            revision: mutation.snapshot.revision,
            removed_ids: removed_history_ids(mutation),
        })
    })
}

fn history_change_for_clear(mutation: &DesktopHistoryMutation) -> Option<HistoryChange> {
    history_replace_for_external_reload(mutation).or_else(|| {
        mutation.changed.then_some(HistoryChange::Clear {
            base_revision: mutation.previous_snapshot.revision,
            revision: mutation.snapshot.revision,
        })
    })
}

fn history_replace_for_external_reload(mutation: &DesktopHistoryMutation) -> Option<HistoryChange> {
    mutation.external_reloaded.then(|| HistoryChange::Replace {
        base_revision: mutation.previous_snapshot.revision,
        revision: mutation.snapshot.revision,
        entries: mutation.snapshot.history.clone(),
    })
}

fn removed_history_ids(mutation: &DesktopHistoryMutation) -> Vec<String> {
    let remaining_ids = mutation
        .snapshot
        .history
        .iter()
        .map(HistoryEntry::id)
        .collect::<HashSet<_>>();

    mutation
        .previous_snapshot
        .history
        .iter()
        .filter(|entry| !remaining_ids.contains(entry.id()))
        .map(|entry| entry.id().to_string())
        .collect()
}

pub fn load_history_from_path(path: &Path) -> Result<Vec<HistoryEntry>, String> {
    load_history_file(path).map(|loaded| loaded.history)
}

pub fn load_history_file(path: &Path) -> Result<LoadedHistoryFile, String> {
    if !path.exists() {
        return Ok(LoadedHistoryFile {
            history: Vec::new(),
            fingerprint: HistoryFileFingerprint::missing(),
        });
    }

    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let content = std::str::from_utf8(&bytes).map_err(|error| error.to_string())?;

    Ok(LoadedHistoryFile {
        history: parse_history_content(content)?,
        fingerprint: fingerprint_for_bytes(&bytes),
    })
}

pub fn history_file_fingerprint(path: &Path) -> Result<HistoryFileFingerprint, String> {
    if !path.exists() {
        return Ok(HistoryFileFingerprint::missing());
    }

    fs::read(path)
        .map(|bytes| fingerprint_for_bytes(&bytes))
        .map_err(|error| error.to_string())
}

pub fn persist_history_to_path(path: &Path, history: &[HistoryEntry]) -> Result<(), String> {
    let content = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;
    write_text_atomically(path, &content)
}

pub fn merge_text_history_item(
    history: Vec<HistoryEntry>,
    text: String,
    source_app: Option<String>,
    max_history_count: usize,
) -> (Vec<HistoryEntry>, HistoryEntry) {
    let copied_at = current_timestamp_millis();
    let new_entry = create_text_entry(text, copied_at, copied_at, source_app, 1);
    let next_history = merge_history(history, new_entry.clone(), max_history_count);
    let saved_entry = next_history.first().cloned().unwrap_or(new_entry);

    (next_history, saved_entry)
}

pub fn remove_history_item_by_id(
    history: Vec<HistoryEntry>,
    id: &str,
) -> (Vec<HistoryEntry>, bool) {
    remove_history_item(history, id)
}

pub fn clear_history_from_path(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    remove_history_assets_for_history_path(path)
}

pub fn cleanup_unused_image_assets_for_history_path(
    history_path: &Path,
    history: &[HistoryEntry],
) -> Result<(), String> {
    let image_dir = history_assets_dir_for_history_path(history_path).join("images");

    if !image_dir.exists() {
        return Ok(());
    }

    let used_paths: HashSet<PathBuf> = history
        .iter()
        .filter_map(|item| item.image_path().map(PathBuf::from))
        .map(|path| path.canonicalize().unwrap_or(path))
        .collect();

    for entry in fs::read_dir(&image_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let comparable_path = path.canonicalize().unwrap_or_else(|_| path.clone());

        if path.extension().and_then(|extension| extension.to_str()) == Some("png")
            && !used_paths.contains(&comparable_path)
        {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn remove_history_assets_for_history_path(history_path: &Path) -> Result<(), String> {
    let assets_dir = history_assets_dir_for_history_path(history_path);

    if assets_dir.exists() {
        fs::remove_dir_all(assets_dir).map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(crate) fn history_assets_dir_for_history_path(history_path: &Path) -> PathBuf {
    history_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("history-assets")
}

fn parse_history_content(content: &str) -> Result<Vec<HistoryEntry>, String> {
    if let Ok(history) = serde_json::from_str::<Vec<HistoryEntry>>(content) {
        return Ok(history);
    }

    if let Ok(legacy_history) = serde_json::from_str::<Vec<LegacyTextHistoryEntry>>(content) {
        return Ok(migrate_structured_text_history(legacy_history));
    }

    serde_json::from_str::<Vec<String>>(content)
        .map(|legacy_history| {
            migrate_legacy_text_history(legacy_history, current_timestamp_millis())
        })
        .map_err(|error| error.to_string())
}

pub(crate) fn history_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app_handle)?.join("history.json"))
}

fn image_assets_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(history_assets_dir_for_history_path(&history_path(app_handle)?).join("images"))
}

fn app_config_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    if let Some(config_dir) = performance_config_dir_override()? {
        return Ok(config_dir);
    }

    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("MCLIP_APP_CONFIG_DIR") {
        return Ok(PathBuf::from(path));
    }

    app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())
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

pub fn merge_history_result(
    history: Vec<HistoryEntry>,
    new_item: HistoryEntry,
    max_history_count: usize,
) -> HistoryMutationResult {
    HistoryMutationResult {
        history: merge_history(history, new_item, max_history_count),
        changed: true,
    }
}

fn remove_history_item(mut history: Vec<HistoryEntry>, id: &str) -> (Vec<HistoryEntry>, bool) {
    let original_len = history.len();
    history.retain(|item| item.id() != id);

    let did_delete = history.len() != original_len;
    (history, did_delete)
}

pub fn remove_history_item_result(history: Vec<HistoryEntry>, id: &str) -> HistoryMutationResult {
    let (history, changed) = remove_history_item(history, id);
    HistoryMutationResult { history, changed }
}

pub fn trim_history_result(
    mut history: Vec<HistoryEntry>,
    max_history_count: usize,
) -> HistoryMutationResult {
    let changed = history.len() > max_history_count;
    if changed {
        history.truncate(max_history_count);
    }

    HistoryMutationResult { history, changed }
}

fn fingerprint_for_bytes(bytes: &[u8]) -> HistoryFileFingerprint {
    HistoryFileFingerprint {
        exists: true,
        byte_len: bytes.len() as u64,
        content_hash: Some(hash_hex(bytes)),
    }
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
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::desktop_state::{DesktopHistoryMutation, DesktopHistorySnapshot};

    use super::{
        cleanup_unused_image_assets_for_history_path, create_text_entry, files_display_text,
        hash_hex, history_change_for_remove, history_change_for_upsert, history_file_fingerprint,
        load_history_file, merge_history, merge_history_result, merge_text_history_item,
        migrate_legacy_text_history, migrate_structured_text_history, remove_history_item,
        remove_history_item_result, trim_history_result, HistoryChange, HistoryEntry,
        HistoryEntryCommon, HistoryKind, HistoryPreviewInvalidation, HistorySnapshot,
        LegacyTextHistoryEntry, NewHistoryItem,
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

    fn unique_history_path(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "mclip-history-{label}-{}-{nonce}.json",
            std::process::id()
        ))
    }

    #[cfg(unix)]
    #[test]
    fn image_cleanup_preserves_assets_referenced_through_an_aliased_root() {
        use std::os::unix::fs::symlink;

        let history_path = unique_history_path("aliased-image-cleanup");
        let root = history_path.with_extension("root");
        let alias = history_path.with_extension("alias");
        let image_dir = root.join("history-assets/images");
        fs::create_dir_all(&image_dir).unwrap();
        let used_path = image_dir.join("used.png");
        let unused_path = image_dir.join("unused.png");
        fs::write(&used_path, b"used").unwrap();
        fs::write(&unused_path, b"unused").unwrap();
        symlink(&root, &alias).unwrap();

        let history = vec![HistoryEntry::Image {
            common: HistoryEntryCommon {
                id: "used-image".to_string(),
                display_text: "used".to_string(),
                first_copied_at: 1,
                last_copied_at: 1,
                source_app: None,
                copy_count: 1,
            },
            image_path: alias
                .join("history-assets/images/used.png")
                .to_string_lossy()
                .into_owned(),
            width: 1,
            height: 1,
            byte_size: 4,
            content_hash: "used".to_string(),
        }];

        cleanup_unused_image_assets_for_history_path(&root.join("history.json"), &history).unwrap();

        assert!(used_path.exists());
        assert!(!unused_path.exists());
        fs::remove_file(alias).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn mutation_results_report_merge_remove_and_trim_changes() {
        let first = text_entry("first", 1000, None);
        let second = text_entry("second", 2000, None);
        let merged = merge_history_result(vec![first.clone()], second.clone(), 10);
        assert!(merged.changed);
        assert_eq!(merged.history, vec![second.clone(), first.clone()]);

        let missing = remove_history_item_result(merged.history.clone(), "missing");
        assert!(!missing.changed);
        assert_eq!(missing.history, merged.history);

        let trimmed = trim_history_result(missing.history, 1);
        assert!(trimmed.changed);
        assert_eq!(trimmed.history, vec![second]);
    }

    #[test]
    fn revisioned_history_contract_serializes_with_camel_case_fields() {
        let entry = text_entry("latest", 2000, None);
        let snapshot = HistorySnapshot {
            entries: vec![entry.clone()],
            revision: 8,
        };
        let upsert = HistoryChange::Upsert {
            base_revision: 7,
            revision: 8,
            entry,
            removed_ids: vec!["trimmed".to_string()],
        };
        let invalidation = HistoryPreviewInvalidation::from(&upsert);

        let snapshot_json = serde_json::to_value(snapshot).unwrap();
        let change_json = serde_json::to_value(upsert).unwrap();
        let invalidation_json = serde_json::to_value(invalidation).unwrap();

        assert_eq!(snapshot_json["revision"], 8);
        assert_eq!(snapshot_json["entries"].as_array().unwrap().len(), 1);
        assert_eq!(change_json["kind"], "upsert");
        assert_eq!(change_json["baseRevision"], 7);
        assert_eq!(change_json["removedIds"][0], "trimmed");
        assert_eq!(invalidation_json["kind"], "upsert");
        assert_eq!(invalidation_json["closeCurrentPreview"], true);
        assert!(invalidation_json.get("entry").is_none());
    }

    #[test]
    fn desktop_mutation_builds_minimal_upsert_and_remove_deltas() {
        let first = text_entry("first", 1000, None);
        let trimmed = text_entry("trimmed", 1500, None);
        let latest = text_entry("latest", 2000, None);
        let upsert_mutation = DesktopHistoryMutation {
            previous_snapshot: DesktopHistorySnapshot {
                revision: 3,
                history: vec![first.clone(), trimmed.clone()],
            },
            snapshot: DesktopHistorySnapshot {
                revision: 4,
                history: vec![latest.clone(), first.clone()],
            },
            changed: true,
            external_reloaded: false,
        };

        assert_eq!(
            history_change_for_upsert(&upsert_mutation),
            Some(HistoryChange::Upsert {
                base_revision: 3,
                revision: 4,
                entry: latest.clone(),
                removed_ids: vec![trimmed.id().to_string()],
            })
        );

        let remove_mutation = DesktopHistoryMutation {
            previous_snapshot: upsert_mutation.snapshot.clone(),
            snapshot: DesktopHistorySnapshot {
                revision: 5,
                history: vec![first],
            },
            changed: true,
            external_reloaded: false,
        };

        assert_eq!(
            history_change_for_remove(&remove_mutation),
            Some(HistoryChange::Remove {
                base_revision: 4,
                revision: 5,
                removed_ids: vec![latest.id().to_string()],
            })
        );
    }

    #[test]
    fn external_reload_uses_replace_instead_of_an_incomplete_delta() {
        let external = text_entry("external", 2000, None);
        let mutation = DesktopHistoryMutation {
            previous_snapshot: DesktopHistorySnapshot {
                revision: 6,
                history: vec![external.clone()],
            },
            snapshot: DesktopHistorySnapshot {
                revision: 6,
                history: vec![external.clone()],
            },
            changed: true,
            external_reloaded: true,
        };

        assert_eq!(
            history_change_for_remove(&mutation),
            Some(HistoryChange::Replace {
                base_revision: 6,
                revision: 6,
                entries: vec![external],
            })
        );
    }

    #[test]
    fn history_file_fingerprint_tracks_content_and_missing_files() {
        let path = unique_history_path("fingerprint");
        let missing = history_file_fingerprint(&path).unwrap();
        assert!(!missing.exists);

        fs::write(&path, "[\"first\"]").unwrap();
        let first = load_history_file(&path).unwrap();
        assert!(first.fingerprint.exists);
        assert_eq!(first.history.len(), 1);

        fs::write(&path, "[\"other\"]").unwrap();
        let other = history_file_fingerprint(&path).unwrap();
        assert_ne!(first.fingerprint.content_hash, other.content_hash);

        fs::remove_file(path).unwrap();
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
    fn merge_text_history_item_reuses_text_dedupe_rules() {
        let history = vec![
            text_entry("first", 1000, None),
            text_entry("second", 2000, Some("Notes")),
        ];

        let (merged, saved_entry) =
            merge_text_history_item(history, "second".to_string(), Some("CLI".to_string()), 10);

        assert_eq!(saved_entry.id(), merged[0].id());
        assert_eq!(merged[0].common().display_text, "second");
        assert_eq!(merged[0].common().first_copied_at, 2000);
        assert_eq!(merged[0].common().source_app.as_deref(), Some("CLI"));
        assert_eq!(merged[0].common().copy_count, 2);
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
