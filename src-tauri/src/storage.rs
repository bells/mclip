//! 通用文件写入工具。
//! 通过临时文件 + rename 降低写入过程中崩溃造成配置/历史文件损坏的概率。

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

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
