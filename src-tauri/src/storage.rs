//! 通用文件写入工具。
//! 通过临时文件 + rename 降低写入过程中崩溃造成配置/历史文件损坏的概率。

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(any(target_os = "macos", target_os = "windows", test))]
pub fn write_text_atomically_if_changed(path: &Path, content: &str) -> Result<bool, String> {
    match fs::read_to_string(path) {
        Ok(existing_content) if existing_content == content => Ok(false),
        Ok(_) => {
            write_text_atomically(path, content)?;
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            write_text_atomically(path, content)?;
            Ok(true)
        }
        Err(error) => Err(error.to_string()),
    }
}

pub fn write_text_atomically(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "target path has no parent directory".to_string())?;

    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "target path has no valid file name".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let process_id = std::process::id();
    let temp_path = parent.join(format!(".{file_name}.{process_id}.{timestamp}.tmp"));

    fs::write(&temp_path, content).map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    if path.exists() {
        // Windows 的 rename 不能稳定覆盖已有文件，先删除目标文件。
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        error.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::{write_text_atomically, write_text_atomically_if_changed};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static NEXT_TEST_PATH_ID: AtomicU64 = AtomicU64::new(0);

    fn unique_test_path(file_name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path_id = NEXT_TEST_PATH_ID.fetch_add(1, Ordering::Relaxed);

        std::env::temp_dir()
            .join(format!(
                "mclip-storage-test-{}-{timestamp}-{path_id}",
                std::process::id(),
            ))
            .join(file_name)
    }

    #[test]
    fn write_text_atomically_if_changed_skips_matching_content() {
        let path = unique_test_path("settings.txt");
        write_text_atomically(&path, "same").unwrap();

        let did_write = write_text_atomically_if_changed(&path, "same").unwrap();

        assert!(!did_write);
        assert_eq!(fs::read_to_string(&path).unwrap(), "same");
        fs::remove_file(&path).unwrap();
        fs::remove_dir(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn write_text_atomically_if_changed_writes_missing_file() {
        let path = unique_test_path("missing.txt");

        let did_write = write_text_atomically_if_changed(&path, "created").unwrap();

        assert!(did_write);
        assert_eq!(fs::read_to_string(&path).unwrap(), "created");
        fs::remove_file(&path).unwrap();
        fs::remove_dir(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn write_text_atomically_if_changed_replaces_different_content() {
        let path = unique_test_path("changed.txt");
        write_text_atomically(&path, "before").unwrap();

        let did_write = write_text_atomically_if_changed(&path, "after").unwrap();

        assert!(did_write);
        assert_eq!(fs::read_to_string(&path).unwrap(), "after");
        fs::remove_file(&path).unwrap();
        fs::remove_dir(path.parent().unwrap()).unwrap();
    }
}
