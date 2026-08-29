//! Desktop-only in-memory state with durable, revisioned history transactions.
//!
//! The CLI intentionally stays on the path-based helpers in `history`; this
//! repository is managed only by the running Tauri process.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use crate::diagnostics::log_error_initialized;
use crate::history::{
    cleanup_unused_image_assets_for_history_path, clear_history_from_path,
    clear_history_keep_pinned_result, history_file_fingerprint, load_history_file,
    merge_history_result, persist_history_to_path, remove_history_item_result,
    replace_text_history_item_result, set_history_item_pinned_result,
    toggle_history_item_pinned_result, trim_history_result, HistoryEntry, HistoryFileFingerprint,
    HistoryMutationResult, LoadedHistoryFile,
};
use crate::image_cache::ImageDataCache;
use crate::settings::AppSettings;

#[derive(Debug, Clone, PartialEq)]
pub struct DesktopHistorySnapshot {
    pub revision: u64,
    pub history: Vec<HistoryEntry>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DesktopHistoryMutation {
    pub previous_snapshot: DesktopHistorySnapshot,
    pub snapshot: DesktopHistorySnapshot,
    pub changed: bool,
    pub external_reloaded: bool,
}

#[derive(Debug, Default)]
struct DesktopHistoryState {
    revision: u64,
    loaded: Option<LoadedHistoryFile>,
}

#[derive(Debug)]
struct DesktopStateInner {
    history: Mutex<DesktopHistoryState>,
    settings: Mutex<AppSettings>,
}

#[derive(Debug, Clone)]
pub struct DesktopStateRepository {
    history_path: Arc<PathBuf>,
    image_cache: Option<ImageDataCache>,
    inner: Arc<DesktopStateInner>,
}

impl DesktopStateRepository {
    pub fn new(history_path: PathBuf, settings: AppSettings) -> Self {
        Self::with_image_cache(history_path, settings, None)
    }

    fn with_image_cache(
        history_path: PathBuf,
        settings: AppSettings,
        image_cache: Option<ImageDataCache>,
    ) -> Self {
        Self {
            history_path: Arc::new(history_path),
            image_cache,
            inner: Arc::new(DesktopStateInner {
                history: Mutex::new(DesktopHistoryState::default()),
                settings: Mutex::new(settings.sanitize()),
            }),
        }
    }

    pub fn for_app(
        history_path: PathBuf,
        settings: AppSettings,
        image_cache: ImageDataCache,
    ) -> Self {
        let mut repository = Self::new(history_path, settings);
        repository.image_cache = Some(image_cache);
        repository
    }

    pub fn settings(&self) -> Result<AppSettings, String> {
        self.inner
            .settings
            .lock()
            .map(|settings| settings.clone())
            .map_err(|error| error.to_string())
    }

    pub fn commit_settings(&self, settings: AppSettings) -> Result<AppSettings, String> {
        let settings = settings.sanitize();
        *self
            .inner
            .settings
            .lock()
            .map_err(|error| error.to_string())? = settings.clone();
        Ok(settings)
    }

    pub fn history_snapshot(&self) -> Result<DesktopHistorySnapshot, String> {
        Ok(self.refresh_history_snapshot()?.snapshot)
    }

    pub fn refresh_history_snapshot(&self) -> Result<DesktopHistoryMutation, String> {
        let mut state = self.lock_history()?;
        self.ensure_history_loaded(&mut state)?;
        let previous_snapshot = snapshot_from_state(&state);
        let external_reloaded = self.reload_external_change(&mut state)?;
        Ok(DesktopHistoryMutation {
            previous_snapshot,
            snapshot: snapshot_from_state(&state),
            changed: external_reloaded,
            external_reloaded,
        })
    }

    pub fn find_history_item(&self, id: &str) -> Result<Option<HistoryEntry>, String> {
        Ok(self
            .history_snapshot()?
            .history
            .into_iter()
            .find(|item| item.id() == id))
    }

    pub fn merge_history_entry(
        &self,
        entry: HistoryEntry,
        max_history_count: usize,
    ) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(|history| merge_history_result(history, entry, max_history_count))
    }

    pub fn delete_history_item(&self, id: &str) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(|history| remove_history_item_result(history, id))
    }

    pub fn trim_history(&self, max_history_count: usize) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(|history| trim_history_result(history, max_history_count))
    }

    pub fn clear_history(&self) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(|history| HistoryMutationResult {
            changed: !history.is_empty() || self.history_path.exists(),
            history: Vec::new(),
        })
    }

    pub fn clear_history_keep_pinned(&self) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(clear_history_keep_pinned_result)
    }

    pub fn set_history_item_pinned(
        &self,
        id: &str,
        is_pinned: bool,
        pinned_at: u64,
    ) -> Result<DesktopHistoryMutation, String> {
        let max_history_count = self.settings()?.max_history_count as usize;
        self.mutate_history_fallible(|history| {
            set_history_item_pinned_result(history, id, is_pinned, pinned_at, max_history_count)
        })
    }

    pub fn toggle_history_item_pinned(
        &self,
        id: &str,
        pinned_at: u64,
    ) -> Result<DesktopHistoryMutation, String> {
        let max_history_count = self.settings()?.max_history_count as usize;
        self.mutate_history_fallible(|history| {
            toggle_history_item_pinned_result(history, id, pinned_at, max_history_count)
        })
    }

    pub fn reclassify_sensitive_history(&self) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history(crate::history::reclassify_sensitive_history_result)
    }

    pub fn replace_history_text(
        &self,
        id: &str,
        text: String,
    ) -> Result<DesktopHistoryMutation, String> {
        let max_history_count = self.settings()?.max_history_count as usize;
        self.mutate_history_fallible(|history| {
            replace_text_history_item_result(history, id, text, max_history_count)
        })
    }

    fn mutate_history(
        &self,
        mutation: impl FnOnce(Vec<HistoryEntry>) -> HistoryMutationResult,
    ) -> Result<DesktopHistoryMutation, String> {
        self.mutate_history_fallible(|history| Ok(mutation(history)))
    }

    fn mutate_history_fallible(
        &self,
        mutation: impl FnOnce(Vec<HistoryEntry>) -> Result<HistoryMutationResult, String>,
    ) -> Result<DesktopHistoryMutation, String> {
        let mut state = self.lock_history()?;
        self.ensure_history_loaded(&mut state)?;
        let external_reloaded = self.reload_external_change(&mut state)?;
        let previous_snapshot = snapshot_from_state(&state);

        let current = state
            .loaded
            .as_ref()
            .map(|loaded| loaded.history.clone())
            .unwrap_or_default();
        let result = mutation(current)?;
        if !result.changed {
            return Ok(DesktopHistoryMutation {
                previous_snapshot,
                snapshot: snapshot_from_state(&state),
                changed: external_reloaded,
                external_reloaded,
            });
        }

        persist_history_transaction(&self.history_path, &result.history)?;
        if let Some(image_cache) = &self.image_cache {
            image_cache.retain_history(&result.history);
        }
        let fingerprint = history_file_fingerprint(&self.history_path)?;
        state.revision = state.revision.saturating_add(1);
        state.loaded = Some(LoadedHistoryFile {
            history: result.history,
            fingerprint,
        });

        Ok(DesktopHistoryMutation {
            previous_snapshot,
            snapshot: snapshot_from_state(&state),
            changed: true,
            external_reloaded,
        })
    }

    fn lock_history(&self) -> Result<MutexGuard<'_, DesktopHistoryState>, String> {
        self.inner.history.lock().map_err(|error| error.to_string())
    }

    fn ensure_history_loaded(&self, state: &mut DesktopHistoryState) -> Result<(), String> {
        if state.loaded.is_none() {
            state.loaded = Some(self.load_history_resilient());
            state.revision = state.revision.saturating_add(1);
        }
        Ok(())
    }

    fn reload_external_change(&self, state: &mut DesktopHistoryState) -> Result<bool, String> {
        let current_fingerprint = history_file_fingerprint(&self.history_path)?;
        let cached_fingerprint = state
            .loaded
            .as_ref()
            .map(|loaded| &loaded.fingerprint)
            .cloned()
            .unwrap_or_else(missing_fingerprint);

        if current_fingerprint != cached_fingerprint {
            let loaded = self.load_history_resilient();
            if let Some(image_cache) = &self.image_cache {
                image_cache.retain_history(&loaded.history);
            }
            state.loaded = Some(loaded);
            state.revision = state.revision.saturating_add(1);
            return Ok(true);
        }
        Ok(false)
    }

    fn load_history_resilient(&self) -> LoadedHistoryFile {
        match load_history_file(&self.history_path) {
            Ok(loaded) => loaded,
            Err(error) => {
                log_error_initialized(
                    "history",
                    &format!("failed to parse clipboard history, using empty history: {error}"),
                );
                LoadedHistoryFile {
                    history: Vec::new(),
                    fingerprint: history_file_fingerprint(&self.history_path)
                        .unwrap_or_else(|_| missing_fingerprint()),
                }
            }
        }
    }
}

fn missing_fingerprint() -> HistoryFileFingerprint {
    HistoryFileFingerprint {
        exists: false,
        byte_len: 0,
        content_hash: None,
    }
}

fn snapshot_from_state(state: &DesktopHistoryState) -> DesktopHistorySnapshot {
    DesktopHistorySnapshot {
        revision: state.revision,
        history: state
            .loaded
            .as_ref()
            .map(|loaded| loaded.history.clone())
            .unwrap_or_default(),
    }
}

fn persist_history_transaction(path: &Path, history: &[HistoryEntry]) -> Result<(), String> {
    if history.is_empty() {
        clear_history_from_path(path)
    } else {
        persist_history_to_path(path, history)?;
        cleanup_unused_image_assets_for_history_path(path, history)
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::history::{
        load_history_from_path, merge_text_history_item, persist_history_to_path, HistoryEntry,
        HistoryEntryCommon,
    };
    use crate::image_cache::ImageDataCache;
    use crate::settings::AppSettings;

    use super::DesktopStateRepository;

    static NEXT_PATH_ID: AtomicU64 = AtomicU64::new(0);

    fn unique_path(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let id = NEXT_PATH_ID.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir()
            .join(format!(
                "mclip-desktop-state-{}-{timestamp}-{id}",
                std::process::id()
            ))
            .join(format!("{label}.json"))
    }

    fn text_entry(text: &str) -> crate::history::HistoryEntry {
        merge_text_history_item(Vec::new(), text.to_string(), None, 10).1
    }

    fn image_entry(path: &std::path::Path, label: &str) -> HistoryEntry {
        HistoryEntry::Image {
            common: HistoryEntryCommon {
                id: format!("image-{label}"),
                display_text: label.to_string(),
                first_copied_at: 1,
                last_copied_at: 1,
                source_app: None,
                copy_count: 1,
                is_pinned: false,
                pinned_at: None,
            },
            image_path: path.to_string_lossy().into_owned(),
            width: 1,
            height: 1,
            byte_size: 4,
            content_hash: label.to_string(),
        }
    }

    #[test]
    fn history_snapshot_loads_lazily_and_keeps_a_stable_revision() {
        let path = unique_path("lazy");
        persist_history_to_path(&path, &[text_entry("first")]).unwrap();
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());

        let first = repository.history_snapshot().unwrap();
        let second = repository.history_snapshot().unwrap();

        assert_eq!(first.revision, 1);
        assert_eq!(second, first);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn text_replacement_advances_one_revision_and_errors_leave_state_unchanged() {
        let path = unique_path("replace-text");
        let entry = text_entry("before");
        let id = entry.id().to_string();
        persist_history_to_path(&path, &[entry]).unwrap();
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());
        let initial = repository.history_snapshot().unwrap();

        let mutation = repository
            .replace_history_text(&id, "after".to_string())
            .unwrap();
        assert!(mutation.changed);
        assert_eq!(mutation.previous_snapshot.revision, initial.revision);
        assert_eq!(mutation.snapshot.revision, initial.revision + 1);
        assert_eq!(mutation.snapshot.history[0].id(), id);

        let error = repository
            .replace_history_text("missing", "never written".to_string())
            .unwrap_err();
        assert_eq!(error, "historyItemNotFound");
        let after_error = repository.history_snapshot().unwrap();
        assert_eq!(after_error, mutation.snapshot);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn history_snapshot_reconciles_an_external_cli_deletion() {
        let path = unique_path("external-delete");
        persist_history_to_path(&path, &[text_entry("initial")]).unwrap();
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());
        let initial = repository.history_snapshot().unwrap();

        fs::remove_file(&path).unwrap();
        let refreshed = repository.refresh_history_snapshot().unwrap();

        assert!(refreshed.external_reloaded);
        assert!(refreshed.changed);
        assert_eq!(refreshed.previous_snapshot, initial);
        assert!(refreshed.snapshot.history.is_empty());
        assert!(refreshed.snapshot.revision > initial.revision);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn poisoned_history_repository_returns_an_error() {
        let path = unique_path("poisoned");
        let repository = DesktopStateRepository::new(path, AppSettings::default());
        let worker_repository = repository.clone();
        let worker = std::thread::spawn(move || {
            let _guard = worker_repository.inner.history.lock().unwrap();
            panic!("synthetic repository poison");
        });
        assert!(worker.join().is_err());

        assert!(repository.refresh_history_snapshot().is_err());
    }

    #[test]
    fn failed_persistence_does_not_advance_the_in_memory_revision() {
        let parent_file = unique_path("blocked-parent");
        fs::create_dir_all(parent_file.parent().unwrap()).unwrap();
        fs::write(&parent_file, "not a directory").unwrap();
        let path = parent_file.join("history.json");
        let repository = DesktopStateRepository::new(path, AppSettings::default());
        let before = repository.history_snapshot().unwrap();

        assert!(repository
            .merge_history_entry(text_entry("new"), 10)
            .is_err());
        let after = repository.history_snapshot().unwrap();
        assert_eq!(after, before);

        fs::remove_file(parent_file).unwrap();
    }

    #[test]
    fn corrupted_desktop_history_falls_back_to_empty_without_repeated_reload() {
        let path = unique_path("corrupted");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "not-json").unwrap();
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());

        let first = repository.history_snapshot().unwrap();
        let second = repository.history_snapshot().unwrap();

        assert!(first.history.is_empty());
        assert_eq!(second, first);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn desktop_mutation_reloads_an_external_cli_change_before_persisting() {
        let path = unique_path("external-change");
        persist_history_to_path(&path, &[text_entry("initial")]).unwrap();
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());
        let initial = repository.history_snapshot().unwrap();

        let mut external = load_history_from_path(&path).unwrap();
        external.insert(0, text_entry("from-cli"));
        persist_history_to_path(&path, &external).unwrap();

        let result = repository
            .merge_history_entry(text_entry("from-desktop"), 10)
            .unwrap();
        let labels = result
            .snapshot
            .history
            .iter()
            .map(|entry| entry.common().display_text.as_str())
            .collect::<Vec<_>>();

        assert!(result.snapshot.revision > initial.revision);
        assert_eq!(labels.last(), Some(&"initial"));
        assert!(labels[..2].contains(&"from-cli"));
        assert!(labels[..2].contains(&"from-desktop"));
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn concurrent_desktop_mutations_are_serialized_without_lost_entries() {
        let path = unique_path("concurrent");
        let repository = DesktopStateRepository::new(path.clone(), AppSettings::default());
        let workers = (0..8)
            .map(|index| {
                let repository = repository.clone();
                std::thread::spawn(move || {
                    repository
                        .merge_history_entry(text_entry(&format!("entry-{index}")), 20)
                        .unwrap();
                })
            })
            .collect::<Vec<_>>();

        for worker in workers {
            worker.join().unwrap();
        }

        let snapshot = repository.history_snapshot().unwrap();
        assert_eq!(snapshot.history.len(), 8);
        assert_eq!(snapshot.revision, 9);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn history_delete_clear_and_trim_invalidate_image_cache_entries() {
        for operation in ["delete", "clear", "trim"] {
            let path = unique_path(operation);
            let image_root = path.parent().unwrap().join("history-assets/images");
            fs::create_dir_all(&image_root).unwrap();
            let first_path = image_root.join("first.png");
            let second_path = image_root.join("second.png");
            fs::write(&first_path, b"first").unwrap();
            fs::write(&second_path, b"second").unwrap();
            let first = image_entry(&first_path, "first");
            let second = image_entry(&second_path, "second");
            persist_history_to_path(&path, &[first.clone(), second.clone()]).unwrap();
            let cache = ImageDataCache::new(image_root);
            cache.get_base64(&first_path).unwrap();
            cache.get_base64(&second_path).unwrap();
            let before_bytes = cache.stats().retained_encoded_bytes;
            let repository = DesktopStateRepository::with_image_cache(
                path.clone(),
                AppSettings::default(),
                Some(cache.clone()),
            );
            repository.history_snapshot().unwrap();

            match operation {
                "delete" => {
                    repository.delete_history_item(second.id()).unwrap();
                }
                "clear" => {
                    repository.clear_history().unwrap();
                }
                "trim" => {
                    repository.trim_history(1).unwrap();
                }
                _ => unreachable!(),
            }

            let after_bytes = cache.stats().retained_encoded_bytes;
            assert!(after_bytes < before_bytes);
            if operation == "clear" {
                assert_eq!(after_bytes, 0);
            }
            fs::remove_dir_all(path.parent().unwrap()).unwrap();
        }
    }

    #[test]
    fn external_history_replace_invalidates_no_longer_referenced_cached_images() {
        let path = unique_path("external-image-replace");
        let image_root = path.parent().unwrap().join("history-assets/images");
        fs::create_dir_all(&image_root).unwrap();
        let old_path = image_root.join("old.png");
        let new_path = image_root.join("new.png");
        fs::write(&old_path, b"old").unwrap();
        fs::write(&new_path, b"new-and-different").unwrap();
        persist_history_to_path(&path, &[image_entry(&old_path, "old")]).unwrap();
        let cache = ImageDataCache::new(image_root);
        cache.get_base64(&old_path).unwrap();
        let repository = DesktopStateRepository::with_image_cache(
            path.clone(),
            AppSettings::default(),
            Some(cache.clone()),
        );
        repository.history_snapshot().unwrap();

        persist_history_to_path(&path, &[image_entry(&new_path, "new")]).unwrap();
        let mutation = repository.trim_history(10).unwrap();

        assert!(mutation.external_reloaded);
        assert_eq!(cache.stats().retained_encoded_bytes, 0);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
