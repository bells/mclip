//! 本地诊断、日志与崩溃捕获。
//! 第一版不做自动联网，只把脱敏后的诊断信息交给用户主动复制或报告。

use std::backtrace::Backtrace;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use arboard::Clipboard;
use tauri::{AppHandle, Manager};

const ISSUE_URL: &str = "https://github.com/bells/mclip/issues/new";
const LOG_FILE_NAME: &str = "mclip.log";
const MAX_CLIENT_LOG_CHARS: usize = 1_200;
const MAX_ISSUE_REPORT_CHARS: usize = 5_000;
const RECENT_LOG_LINE_COUNT: usize = 40;

static LOG_FILE_PATH: OnceLock<PathBuf> = OnceLock::new();
static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();

#[derive(Debug)]
pub struct DiagnosticReportInput {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub locale: String,
    pub log_dir: String,
    pub recent_logs: Vec<String>,
}

pub fn initialize_diagnostics(app_handle: &AppHandle) -> Result<(), String> {
    let path = log_file_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let _ = LOG_FILE_PATH.set(path);
    install_panic_hook();
    log_info(app_handle, "app", "diagnostics initialized");

    Ok(())
}

#[tauri::command]
pub fn open_logs_dir(app_handle: AppHandle) -> Result<(), String> {
    let dir = log_dir(&app_handle)?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    log_info(&app_handle, "diagnostics", "opening logs directory");
    open_path(&dir)
}

#[tauri::command]
pub fn copy_diagnostic_report(app_handle: AppHandle) -> Result<(), String> {
    let report = collect_diagnostic_report(&app_handle)?;
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(report))
        .map_err(|error| error.to_string())?;
    log_info(&app_handle, "diagnostics", "diagnostic report copied");

    Ok(())
}

#[tauri::command]
pub fn open_issue_report(app_handle: AppHandle) -> Result<(), String> {
    let report = truncate_log_line(
        &collect_diagnostic_report(&app_handle)?,
        MAX_ISSUE_REPORT_CHARS,
    );
    let body = format!(
        "Please describe what happened:\n\n\n---\nDiagnostic information:\n\n{}",
        report
    );
    let url = format!(
        "{ISSUE_URL}?title={}&body={}",
        encode_url_component("mclip issue report"),
        encode_url_component(&body),
    );

    log_info(&app_handle, "diagnostics", "opening issue report url");
    open_url(&url)
}

#[tauri::command]
pub fn write_client_log(
    app_handle: AppHandle,
    level: String,
    message: String,
    context: Option<String>,
) -> Result<(), String> {
    let normalized_level = match level.as_str() {
        "error" => "ERROR",
        "warn" | "warning" => "WARN",
        _ => "INFO",
    };
    let message = match context {
        Some(context) if !context.trim().is_empty() => format!("{message} | {context}"),
        _ => message,
    };

    write_app_log(Some(&app_handle), normalized_level, "frontend", &message)
}

pub fn log_info(app_handle: &AppHandle, target: &str, message: &str) {
    let _ = write_app_log(Some(app_handle), "INFO", target, message);
}

pub fn log_error(app_handle: &AppHandle, target: &str, message: &str) {
    let _ = write_app_log(Some(app_handle), "ERROR", target, message);
}

pub fn build_diagnostic_report(input: DiagnosticReportInput) -> String {
    let mut lines = vec![
        "mclip diagnostics".to_string(),
        String::new(),
        format!("App version: {}", input.app_version),
        format!("Platform: {} / {}", input.os, input.arch),
        format!("Locale: {}", input.locale),
        format!(
            "Log directory: {}",
            sanitize_diagnostic_line(&input.log_dir)
        ),
        String::new(),
        "Recent logs:".to_string(),
    ];

    if input.recent_logs.is_empty() {
        lines.push("No recent logs.".to_string());
    } else {
        lines.extend(
            input
                .recent_logs
                .into_iter()
                .map(|line| sanitize_diagnostic_line(&line)),
        );
    }

    lines.join("\n")
}

pub fn sanitize_diagnostic_line(line: &str) -> String {
    line.split_whitespace()
        .map(|token| {
            if looks_like_path_token(token) {
                "<path>"
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn collect_diagnostic_report(app_handle: &AppHandle) -> Result<String, String> {
    let input = DiagnosticReportInput {
        app_version: app_handle.package_info().version.to_string(),
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        locale: current_locale(),
        log_dir: log_dir(app_handle)?.to_string_lossy().into_owned(),
        recent_logs: read_recent_log_lines(app_handle)?,
    };

    Ok(build_diagnostic_report(input))
}

fn current_locale() -> String {
    env::var("LC_ALL")
        .or_else(|_| env::var("LC_MESSAGES"))
        .or_else(|_| env::var("LANG"))
        .unwrap_or_else(|_| "unknown".to_string())
}

fn install_panic_hook() {
    if PANIC_HOOK_INSTALLED.set(()).is_err() {
        return;
    }

    let previous_hook = panic::take_hook();
    panic::set_hook(Box::new(move |panic_info| {
        let backtrace = Backtrace::force_capture();
        let message = format!("panic: {panic_info}\nbacktrace:\n{backtrace}");
        let _ = write_app_log(None, "ERROR", "panic", &message);
        previous_hook(panic_info);
    }));
}

fn write_app_log(
    app_handle: Option<&AppHandle>,
    level: &str,
    target: &str,
    message: &str,
) -> Result<(), String> {
    let path = match LOG_FILE_PATH.get() {
        Some(path) => path.clone(),
        None => {
            let app_handle =
                app_handle.ok_or_else(|| "diagnostic log file is not initialized".to_string())?;
            log_file_path(app_handle)?
        }
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let timestamp = current_timestamp_seconds();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| error.to_string())?;

    for line in message.lines() {
        let line = truncate_log_line(&sanitize_diagnostic_line(line), MAX_CLIENT_LOG_CHARS);
        writeln!(file, "{timestamp} [{level}] {target}: {line}")
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn read_recent_log_lines(app_handle: &AppHandle) -> Result<Vec<String>, String> {
    let path = log_file_path(app_handle)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut lines = content
        .lines()
        .rev()
        .take(RECENT_LOG_LINE_COUNT)
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    lines.reverse();

    Ok(lines)
}

fn log_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())
}

fn log_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(log_dir(app_handle)?.join(LOG_FILE_NAME))
}

fn current_timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn truncate_log_line(line: &str, max_chars: usize) -> String {
    if line.chars().count() <= max_chars {
        return line.to_string();
    }

    let mut truncated = line.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn looks_like_path_token(token: &str) -> bool {
    let trimmed = token.trim_matches(|character: char| {
        matches!(
            character,
            '"' | '\'' | '`' | ',' | ';' | ':' | '(' | ')' | '[' | ']'
        )
    });

    (trimmed.len() > 1 && trimmed.starts_with('/'))
        || trimmed.starts_with("~/")
        || trimmed.starts_with(r"\\")
        || has_windows_drive_path(trimmed)
        || trimmed.contains("/Users/")
        || trimmed.contains("\\Users\\")
}

fn has_windows_drive_path(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn open_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(path).spawn();

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(path).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(path).spawn();

    result.map(|_| ()).map_err(|error| error.to_string())
}

fn open_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(url).spawn();

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(url).spawn();

    result.map(|_| ()).map_err(|error| error.to_string())
}

fn encode_url_component(value: &str) -> String {
    let mut encoded = String::new();

    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }

    encoded
}

#[cfg(test)]
mod tests {
    use super::{build_diagnostic_report, sanitize_diagnostic_line, DiagnosticReportInput};

    #[test]
    fn diagnostic_report_includes_runtime_context_and_redacted_logs() {
        let input = DiagnosticReportInput {
            app_version: "0.1.0".to_string(),
            os: "macos".to_string(),
            arch: "aarch64".to_string(),
            locale: "zh-CN".to_string(),
            log_dir: "/Users/watson/Library/Logs/com.watson.mclip".to_string(),
            recent_logs: vec!["[ERROR] failed to read /Users/watson/Desktop/secret.txt".to_string()],
        };

        let report = build_diagnostic_report(input);

        assert!(report.contains("mclip diagnostics"));
        assert!(report.contains("App version: 0.1.0"));
        assert!(report.contains("Platform: macos / aarch64"));
        assert!(report.contains("Locale: zh-CN"));
        assert!(report.contains("Log directory: <path>"));
        assert!(report.contains("[ERROR] failed to read <path>"));
        assert!(!report.contains("/Users/watson"));
    }

    #[test]
    fn sanitize_diagnostic_line_redacts_unix_and_windows_paths() {
        let line = "panic at /Users/alice/Documents/a.txt and C:\\Users\\Bob\\Desktop\\b.txt";

        let sanitized = sanitize_diagnostic_line(line);

        assert_eq!(sanitized, "panic at <path> and <path>");
    }
}
