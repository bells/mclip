//! Bounded process-wide cache for app-owned history image data.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::history::HistoryEntry;
use crate::performance::{
    record_rust_milestone, PerformanceMilestoneName, PerformanceOutcome, PerformanceRecorder,
    PerformanceWindowLabel,
};

pub const DEFAULT_IMAGE_CACHE_MAX_BYTES: usize = 32 * 1024 * 1024;
pub const DEFAULT_IMAGE_CACHE_MAX_ENTRY_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ImageCacheOutcome {
    Hit,
    Miss,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ImageCacheRead {
    pub base64: String,
    pub outcome: ImageCacheOutcome,
}

#[derive(Debug, Clone, Copy, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheStats {
    pub hits: u64,
    pub misses: u64,
    pub peak_encoded_bytes: usize,
    pub retained_encoded_bytes: usize,
}

#[derive(Debug, Clone, Eq, Hash, PartialEq)]
struct ImageCacheKey {
    canonical_path: PathBuf,
    byte_len: u64,
    modified_nanos: u128,
}

#[derive(Debug)]
struct CacheEntry {
    base64: Arc<str>,
    encoded_bytes: usize,
    last_used: u64,
}

type SharedLoadResult = Result<Arc<str>, String>;

#[derive(Debug, Default)]
struct InFlightLoad {
    result: Mutex<Option<SharedLoadResult>>,
    ready: Condvar,
}

#[derive(Debug, Default)]
struct ImageCacheState {
    entries: HashMap<ImageCacheKey, CacheEntry>,
    in_flight: HashMap<ImageCacheKey, Arc<InFlightLoad>>,
    logical_clock: u64,
    retained_encoded_bytes: usize,
    stats: ImageCacheStats,
}

#[derive(Debug, Clone)]
pub struct ImageDataCache {
    allowed_root: Arc<PathBuf>,
    max_bytes: usize,
    max_entry_bytes: usize,
    state: Arc<Mutex<ImageCacheState>>,
}

impl ImageDataCache {
    pub fn new(allowed_root: PathBuf) -> Self {
        Self::with_limits(
            allowed_root,
            DEFAULT_IMAGE_CACHE_MAX_BYTES,
            DEFAULT_IMAGE_CACHE_MAX_ENTRY_BYTES,
        )
    }

    fn with_limits(allowed_root: PathBuf, max_bytes: usize, max_entry_bytes: usize) -> Self {
        Self {
            allowed_root: Arc::new(allowed_root),
            max_bytes,
            max_entry_bytes,
            state: Arc::new(Mutex::new(ImageCacheState::default())),
        }
    }

    pub fn get_base64(&self, path: &Path) -> Result<ImageCacheRead, String> {
        let key = match self.key_for_path(path) {
            Ok(key) => key,
            Err(error) => {
                self.invalidate_path(path);
                return Err(error);
            }
        };
        let read_path = key.canonical_path.clone();
        self.get_or_load(key, move || {
            std::fs::read(read_path).map_err(|error| error.to_string())
        })
    }

    pub fn retain_history(&self, history: &[HistoryEntry]) {
        let retained_paths = history
            .iter()
            .filter_map(|entry| entry.image_path())
            .filter_map(|path| Path::new(path).canonicalize().ok())
            .collect::<HashSet<_>>();

        if let Ok(mut state) = self.state.lock() {
            let removed_bytes = state
                .entries
                .iter()
                .filter(|(key, _)| !retained_paths.contains(&key.canonical_path))
                .map(|(_, entry)| entry.encoded_bytes)
                .sum::<usize>();
            state
                .entries
                .retain(|key, _| retained_paths.contains(&key.canonical_path));
            state.retained_encoded_bytes =
                state.retained_encoded_bytes.saturating_sub(removed_bytes);
            state.stats.retained_encoded_bytes = state.retained_encoded_bytes;
        }
    }

    pub fn stats(&self) -> ImageCacheStats {
        self.state
            .lock()
            .map(|state| state.stats)
            .unwrap_or_default()
    }

    fn key_for_path(&self, path: &Path) -> Result<ImageCacheKey, String> {
        let canonical_path = path
            .canonicalize()
            .map_err(|error| format!("failed to resolve history image: {error}"))?;
        let canonical_root = self
            .allowed_root
            .canonicalize()
            .map_err(|error| format!("failed to resolve history image root: {error}"))?;

        if !canonical_path.starts_with(&canonical_root) {
            return Err("history image path is outside the app-owned image directory".to_string());
        }

        let metadata = canonical_path
            .metadata()
            .map_err(|error| format!("failed to read history image metadata: {error}"))?;
        if !metadata.is_file() {
            return Err("history image path is not a file".to_string());
        }

        Ok(ImageCacheKey {
            canonical_path,
            byte_len: metadata.len(),
            modified_nanos: modified_nanos(metadata.modified().ok()),
        })
    }

    fn get_or_load(
        &self,
        key: ImageCacheKey,
        loader: impl FnOnce() -> Result<Vec<u8>, String>,
    ) -> Result<ImageCacheRead, String> {
        let follower = {
            let mut state = self.state.lock().map_err(|error| error.to_string())?;
            remove_stale_path_entries(&mut state, &key);
            state.logical_clock = state.logical_clock.saturating_add(1);
            let logical_clock = state.logical_clock;

            if let Some(entry) = state.entries.get_mut(&key) {
                entry.last_used = logical_clock;
                let base64 = entry.base64.to_string();
                state.stats.hits = state.stats.hits.saturating_add(1);
                return Ok(ImageCacheRead {
                    base64,
                    outcome: ImageCacheOutcome::Hit,
                });
            }

            if let Some(in_flight) = state.in_flight.get(&key).cloned() {
                state.stats.hits = state.stats.hits.saturating_add(1);
                Some(in_flight)
            } else {
                state.stats.misses = state.stats.misses.saturating_add(1);
                state
                    .in_flight
                    .insert(key.clone(), Arc::new(InFlightLoad::default()));
                None
            }
        };

        if let Some(in_flight) = follower {
            let base64 = wait_for_in_flight(&in_flight)?;
            return Ok(ImageCacheRead {
                base64: base64.to_string(),
                outcome: ImageCacheOutcome::Hit,
            });
        }

        let loaded = loader().map(|bytes| Arc::<str>::from(BASE64_STANDARD.encode(bytes)));
        let key_is_current = loaded.is_ok()
            && self
                .key_for_path(&key.canonical_path)
                .is_ok_and(|current_key| current_key == key);
        let in_flight = {
            let mut state = self.state.lock().map_err(|error| error.to_string())?;
            let in_flight = state
                .in_flight
                .remove(&key)
                .ok_or_else(|| "history image load lost its single-flight state".to_string())?;

            if key_is_current {
                let base64 = loaded
                    .as_ref()
                    .expect("a current image cache key requires a successful load");
                retain_loaded_entry(
                    &mut state,
                    key,
                    Arc::clone(base64),
                    self.max_bytes,
                    self.max_entry_bytes,
                );
            }
            in_flight
        };

        if let Ok(mut result) = in_flight.result.lock() {
            *result = Some(loaded.clone());
            in_flight.ready.notify_all();
        }

        loaded.map(|base64| ImageCacheRead {
            base64: base64.to_string(),
            outcome: ImageCacheOutcome::Miss,
        })
    }

    fn invalidate_path(&self, path: &Path) {
        if let Ok(mut state) = self.state.lock() {
            let removed_bytes = state
                .entries
                .iter()
                .filter(|(key, _)| key.canonical_path == path)
                .map(|(_, entry)| entry.encoded_bytes)
                .sum::<usize>();
            state.entries.retain(|key, _| key.canonical_path != path);
            state.retained_encoded_bytes =
                state.retained_encoded_bytes.saturating_sub(removed_bytes);
            state.stats.retained_encoded_bytes = state.retained_encoded_bytes;
        }
    }
}

#[tauri::command]
pub async fn get_image_base64(
    app_handle: AppHandle,
    window: WebviewWindow,
    path: String,
) -> Result<String, String> {
    let cache = app_handle.state::<ImageDataCache>().inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || cache.get_base64(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?;
    let window_label = PerformanceWindowLabel::from_window_label(window.label());
    let recorder = app_handle.state::<PerformanceRecorder>();

    match result {
        Ok(read) => {
            record_rust_milestone(
                &recorder,
                match read.outcome {
                    ImageCacheOutcome::Hit => PerformanceMilestoneName::ImageCacheHit,
                    ImageCacheOutcome::Miss => PerformanceMilestoneName::ImageCacheMiss,
                },
                window_label,
                None,
                PerformanceOutcome::Success,
            );
            Ok(read.base64)
        }
        Err(error) => {
            record_rust_milestone(
                &recorder,
                PerformanceMilestoneName::ImageCacheMiss,
                window_label,
                None,
                PerformanceOutcome::Failure,
            );
            Err(error)
        }
    }
}

#[tauri::command]
pub fn get_image_cache_stats(cache: tauri::State<'_, ImageDataCache>) -> ImageCacheStats {
    cache.stats()
}

fn modified_nanos(modified: Option<SystemTime>) -> u128 {
    modified
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}

fn wait_for_in_flight(in_flight: &InFlightLoad) -> SharedLoadResult {
    let mut result = in_flight.result.lock().map_err(|error| error.to_string())?;
    while result.is_none() {
        result = in_flight
            .ready
            .wait(result)
            .map_err(|error| error.to_string())?;
    }
    result
        .as_ref()
        .cloned()
        .ok_or_else(|| "history image load completed without a result".to_string())?
}

fn remove_stale_path_entries(state: &mut ImageCacheState, key: &ImageCacheKey) {
    let removed_bytes = state
        .entries
        .iter()
        .filter(|(existing_key, _)| {
            existing_key.canonical_path == key.canonical_path && *existing_key != key
        })
        .map(|(_, entry)| entry.encoded_bytes)
        .sum::<usize>();
    state.entries.retain(|existing_key, _| {
        existing_key.canonical_path != key.canonical_path || existing_key == key
    });
    state.retained_encoded_bytes = state.retained_encoded_bytes.saturating_sub(removed_bytes);
    state.stats.retained_encoded_bytes = state.retained_encoded_bytes;
}

fn retain_loaded_entry(
    state: &mut ImageCacheState,
    key: ImageCacheKey,
    base64: Arc<str>,
    max_bytes: usize,
    max_entry_bytes: usize,
) {
    let encoded_bytes = base64.len();
    if encoded_bytes > max_entry_bytes || encoded_bytes > max_bytes {
        return;
    }

    while state.retained_encoded_bytes.saturating_add(encoded_bytes) > max_bytes {
        let Some(lru_key) = state
            .entries
            .iter()
            .min_by_key(|(_, entry)| entry.last_used)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        if let Some(removed) = state.entries.remove(&lru_key) {
            state.retained_encoded_bytes = state
                .retained_encoded_bytes
                .saturating_sub(removed.encoded_bytes);
        }
    }

    state.logical_clock = state.logical_clock.saturating_add(1);
    let logical_clock = state.logical_clock;
    state.entries.insert(
        key,
        CacheEntry {
            base64,
            encoded_bytes,
            last_used: logical_clock,
        },
    );
    state.retained_encoded_bytes = state.retained_encoded_bytes.saturating_add(encoded_bytes);
    state.stats.retained_encoded_bytes = state.retained_encoded_bytes;
    state.stats.peak_encoded_bytes = state
        .stats
        .peak_encoded_bytes
        .max(state.retained_encoded_bytes);
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use super::{ImageCacheKey, ImageCacheOutcome, ImageDataCache};

    fn unique_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "mclip-image-cache-{label}-{}-{nonce}",
            std::process::id()
        ))
    }

    fn fake_key(label: &str) -> ImageCacheKey {
        ImageCacheKey {
            canonical_path: PathBuf::from(label),
            byte_len: 1,
            modified_nanos: 1,
        }
    }

    #[test]
    fn path_validation_accepts_only_app_owned_files() {
        let root = unique_dir("validation");
        let outside = unique_dir("outside").join("outside.png");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(outside.parent().unwrap()).unwrap();
        let inside = root.join("inside.png");
        fs::write(&inside, b"inside").unwrap();
        fs::write(&outside, b"outside").unwrap();
        let cache = ImageDataCache::new(root.clone());

        assert!(cache.get_base64(&inside).is_ok());
        assert!(cache.get_base64(&outside).is_err());

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside.parent().unwrap()).unwrap();
    }

    #[test]
    fn concurrent_success_and_failure_are_single_flight() {
        for should_fail in [false, true] {
            let root = unique_dir(if should_fail { "failure" } else { "success" });
            fs::create_dir_all(&root).unwrap();
            let cache = ImageDataCache::with_limits(root.clone(), 1024, 1024);
            let key = fake_key(if should_fail { "failure" } else { "success" });
            let load_count = Arc::new(AtomicUsize::new(0));
            let barrier = Arc::new(Barrier::new(8));
            let workers = (0..8)
                .map(|_| {
                    let cache = cache.clone();
                    let key = key.clone();
                    let load_count = Arc::clone(&load_count);
                    let barrier = Arc::clone(&barrier);
                    std::thread::spawn(move || {
                        barrier.wait();
                        cache.get_or_load(key, || {
                            load_count.fetch_add(1, Ordering::SeqCst);
                            std::thread::sleep(Duration::from_millis(20));
                            if should_fail {
                                Err("expected failure".to_string())
                            } else {
                                Ok(b"shared".to_vec())
                            }
                        })
                    })
                })
                .collect::<Vec<_>>();
            let results = workers
                .into_iter()
                .map(|worker| worker.join().unwrap())
                .collect::<Vec<_>>();

            assert_eq!(load_count.load(Ordering::SeqCst), 1);
            assert!(results.iter().all(|result| result.is_err()) == should_fail);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn lru_uses_encoded_bytes_and_respects_recent_hits() {
        let root = unique_dir("lru");
        fs::create_dir_all(&root).unwrap();
        let cache = ImageDataCache::with_limits(root.clone(), 16, 16);
        let first = root.join("first.png");
        let second = root.join("second.png");
        let third = root.join("third.png");
        fs::write(&first, b"1111").unwrap();
        fs::write(&second, b"2222").unwrap();
        fs::write(&third, b"3333").unwrap();

        cache.get_base64(&first).unwrap();
        cache.get_base64(&second).unwrap();
        assert_eq!(
            cache.get_base64(&first).unwrap().outcome,
            ImageCacheOutcome::Hit
        );
        cache.get_base64(&third).unwrap();

        let second_reload = cache.get_base64(&second).unwrap();
        assert_eq!(second_reload.outcome, ImageCacheOutcome::Miss);
        assert!(cache.stats().peak_encoded_bytes <= 16);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn oversized_entry_is_returned_but_not_retained() {
        let root = unique_dir("oversized");
        fs::create_dir_all(&root).unwrap();
        let cache = ImageDataCache::with_limits(root.clone(), 64, 4);
        let key = fake_key("oversized");
        let first = cache
            .get_or_load(key.clone(), || Ok(b"large".to_vec()))
            .unwrap();
        let second = cache.get_or_load(key, || Ok(b"large".to_vec())).unwrap();

        assert_eq!(first.outcome, ImageCacheOutcome::Miss);
        assert_eq!(second.outcome, ImageCacheOutcome::Miss);
        assert_eq!(cache.stats().retained_encoded_bytes, 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn metadata_change_missing_file_and_cleanup_invalidate_cached_data() {
        let root = unique_dir("invalidation");
        fs::create_dir_all(&root).unwrap();
        let first = root.join("first.png");
        let second = root.join("second.png");
        fs::write(&first, b"one").unwrap();
        fs::write(&second, b"two").unwrap();
        let cache = ImageDataCache::new(root.clone());

        let original = cache.get_base64(&first).unwrap();
        cache.get_base64(&second).unwrap();
        fs::write(&first, b"changed-and-longer").unwrap();
        let changed = cache.get_base64(&first).unwrap();
        assert_ne!(original.base64, changed.base64);

        cache.retain_history(&[]);
        assert_eq!(cache.stats().retained_encoded_bytes, 0);
        fs::remove_file(&first).unwrap();
        assert!(cache.get_base64(&first).is_err());
        assert_eq!(cache.stats().retained_encoded_bytes, 0);

        fs::remove_dir_all(root).unwrap();
    }
}
