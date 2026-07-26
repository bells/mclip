//! mclip-cli 的版本检测、Release 下载与用户目录安装入口。

use std::env;
use std::ffi::OsString;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::redirect::Policy;
use semver::Version;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::AppHandle;

const CLI_INSTALL_COMMAND: &str = "curl -fsSL https://www.mclip.cn/install.sh | sh";
const CLI_RELEASE_BASE_URL: &str = "https://github.com/bells/mclip/releases";
const CLI_VERSION_PREFIX: &str = "mclip-cli ";
const CLI_VERSION_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const CLI_HTTP_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_CLI_BINARY_BYTES: usize = 32 * 1024 * 1024;
const MAX_CHECKSUM_BYTES: usize = 4 * 1024;
const MAX_VERSION_OUTPUT_BYTES: usize = 1024;

static CLI_INSTALL_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CliInstallState {
    NotInstalled,
    Current,
    Outdated,
    Newer,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstallStatus {
    pub executable_name: String,
    pub install_command: String,
    pub install_dir: String,
    pub install_path: String,
    pub installed_version: Option<String>,
    pub is_installed: bool,
    pub is_on_path: bool,
    pub platform_supported: bool,
    pub state: CliInstallState,
    pub target_version: String,
}

#[derive(Debug, Clone)]
pub struct CliReleaseClient {
    base_url: String,
    client: reqwest::Client,
}

impl CliReleaseClient {
    pub fn github() -> Result<Self, String> {
        Self::new(CLI_RELEASE_BASE_URL)
    }

    pub fn new(base_url: impl Into<String>) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .redirect(Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    return attempt.stop();
                }

                let started_with_https = attempt
                    .previous()
                    .first()
                    .is_some_and(|url| url.scheme() == "https");

                if started_with_https && attempt.url().scheme() != "https" {
                    return attempt.stop();
                }

                attempt.follow()
            }))
            .timeout(CLI_HTTP_TIMEOUT)
            .build()
            .map_err(|error| cli_error("CLI_DOWNLOAD_FAILED", error))?;

        Ok(Self {
            base_url: base_url.into(),
            client,
        })
    }

    pub async fn download_release(
        &self,
        version: &Version,
        asset_name: &str,
    ) -> Result<(Vec<u8>, String), String> {
        let binary_url = release_download_url(&self.base_url, version, asset_name);
        let checksum_name = checksum_asset_name(asset_name);
        let checksum_url = release_download_url(&self.base_url, version, &checksum_name);

        let binary = self
            .download_limited(&binary_url, MAX_CLI_BINARY_BYTES, "CLI_RELEASE_UNAVAILABLE")
            .await?;
        let checksum = self
            .download_limited(
                &checksum_url,
                MAX_CHECKSUM_BYTES,
                "CLI_CHECKSUM_UNAVAILABLE",
            )
            .await?;
        let checksum = String::from_utf8(checksum)
            .map_err(|error| cli_error("CLI_CHECKSUM_INVALID", error))?;

        Ok((binary, checksum))
    }

    async fn download_limited(
        &self,
        url: &str,
        max_bytes: usize,
        unavailable_code: &str,
    ) -> Result<Vec<u8>, String> {
        let mut response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| cli_error("CLI_DOWNLOAD_FAILED", error))?;

        if !response.status().is_success() {
            return Err(cli_error(
                unavailable_code,
                format!("HTTP {} for {url}", response.status()),
            ));
        }

        if response
            .content_length()
            .is_some_and(|length| length > max_bytes as u64)
        {
            return Err(cli_error(
                "CLI_DOWNLOAD_TOO_LARGE",
                format!("response exceeds {max_bytes} bytes"),
            ));
        }

        let mut bytes = Vec::with_capacity(
            response
                .content_length()
                .unwrap_or_default()
                .min(max_bytes as u64) as usize,
        );

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| cli_error("CLI_DOWNLOAD_FAILED", error))?
        {
            let next_size = bytes
                .len()
                .checked_add(chunk.len())
                .ok_or_else(|| cli_error("CLI_DOWNLOAD_TOO_LARGE", "response size overflow"))?;

            if next_size > max_bytes {
                return Err(cli_error(
                    "CLI_DOWNLOAD_TOO_LARGE",
                    format!("response exceeds {max_bytes} bytes"),
                ));
            }

            bytes.extend_from_slice(&chunk);
        }

        Ok(bytes)
    }
}

#[derive(Debug)]
struct CliInstallGuard;

impl CliInstallGuard {
    fn acquire() -> Result<Self, String> {
        CLI_INSTALL_IN_PROGRESS
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                cli_error(
                    "CLI_INSTALL_BUSY",
                    "another mclip-cli installation is already in progress",
                )
            })?;

        Ok(Self)
    }
}

impl Drop for CliInstallGuard {
    fn drop(&mut self) {
        CLI_INSTALL_IN_PROGRESS.store(false, Ordering::Release);
    }
}

#[tauri::command]
pub async fn get_cli_install_status(app_handle: AppHandle) -> Result<CliInstallStatus, String> {
    let target_version = app_handle.package_info().version.to_string();
    current_cli_install_status(target_version).await
}

#[tauri::command]
pub async fn install_cli(app_handle: AppHandle) -> Result<CliInstallStatus, String> {
    let _guard = CliInstallGuard::acquire()?;
    let target_version_text = app_handle.package_info().version.to_string();
    let asset_name = release_asset_for_current_platform().ok_or_else(|| {
        cli_error(
            "CLI_UNSUPPORTED_PLATFORM",
            format!(
                "{}-{} has no published mclip-cli asset",
                env::consts::OS,
                env::consts::ARCH
            ),
        )
    })?;
    let install_dir = default_install_dir()?;
    let path_env = env::var("PATH").ok();
    let release_client = runtime_release_client()?;

    install_cli_release(
        &release_client,
        &install_dir,
        path_env.as_deref(),
        &target_version_text,
        Some(asset_name),
    )
    .await
}

pub fn cli_install_command() -> &'static str {
    CLI_INSTALL_COMMAND
}

pub fn cli_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "mclip-cli.exe"
    } else {
        "mclip-cli"
    }
}

pub fn release_asset_name(os: &str, arch: &str) -> Option<&'static str> {
    match (os, arch) {
        ("macos", "aarch64") => Some("mclip-cli-darwin-arm64"),
        ("windows", "x86_64") => Some("mclip-cli-windows-x64.exe"),
        _ => None,
    }
}

pub fn release_asset_for_current_platform() -> Option<&'static str> {
    release_asset_name(env::consts::OS, env::consts::ARCH)
}

pub fn checksum_asset_name(asset_name: &str) -> String {
    format!("{asset_name}.sha256")
}

pub fn release_download_url(base_url: &str, version: &Version, asset_name: &str) -> String {
    format!(
        "{}/download/v{version}/{asset_name}",
        base_url.trim_end_matches('/')
    )
}

pub fn parse_checksum(checksum: &str) -> Result<String, String> {
    let digest = checksum
        .split_ascii_whitespace()
        .next()
        .ok_or_else(|| cli_error("CLI_CHECKSUM_INVALID", "checksum is empty"))?;

    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(cli_error(
            "CLI_CHECKSUM_INVALID",
            "checksum must start with 64 hexadecimal characters",
        ));
    }

    Ok(digest.to_ascii_lowercase())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn parse_cli_version_output(output: &[u8]) -> Result<Version, String> {
    if output.len() > MAX_VERSION_OUTPUT_BYTES {
        return Err(cli_error(
            "CLI_VERSION_UNKNOWN",
            "version output is too large",
        ));
    }

    let output = std::str::from_utf8(output)
        .map_err(|error| cli_error("CLI_VERSION_UNKNOWN", error))?
        .trim();
    let version = output
        .strip_prefix(CLI_VERSION_PREFIX)
        .ok_or_else(|| cli_error("CLI_VERSION_UNKNOWN", "unexpected version output"))?;

    if version.is_empty() || version.bytes().any(|byte| byte.is_ascii_whitespace()) {
        return Err(cli_error(
            "CLI_VERSION_UNKNOWN",
            "unexpected version output",
        ));
    }

    Version::parse(version).map_err(|error| cli_error("CLI_VERSION_UNKNOWN", error))
}

pub fn classify_cli_state(
    is_installed: bool,
    installed_version: Option<&Version>,
    target_version: &Version,
) -> CliInstallState {
    if !is_installed {
        return CliInstallState::NotInstalled;
    }

    match installed_version {
        Some(version) if version < target_version => CliInstallState::Outdated,
        Some(version) if version > target_version => CliInstallState::Newer,
        Some(_) => CliInstallState::Current,
        None => CliInstallState::Unknown,
    }
}

pub fn probe_cli_version(path: &Path, timeout: Duration) -> Result<Version, String> {
    let mut child = Command::new(path)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| cli_error("CLI_VERSION_UNKNOWN", error))?;
    let started_at = std::time::Instant::now();

    loop {
        match child
            .try_wait()
            .map_err(|error| cli_error("CLI_VERSION_UNKNOWN", error))?
        {
            Some(status) => {
                let output = child
                    .wait_with_output()
                    .map_err(|error| cli_error("CLI_VERSION_UNKNOWN", error))?;

                if !status.success() {
                    return Err(cli_error(
                        "CLI_VERSION_UNKNOWN",
                        format!("version probe exited with {status}"),
                    ));
                }

                return parse_cli_version_output(&output.stdout);
            }
            None if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(cli_error("CLI_VERSION_UNKNOWN", "version probe timed out"));
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    }
}

pub fn cli_status_from_install_dir(
    install_dir: &Path,
    path_env: Option<&str>,
    target_version_text: &str,
    platform_supported: bool,
) -> Result<CliInstallStatus, String> {
    let target_version = Version::parse(target_version_text)
        .map_err(|error| cli_error("CLI_TARGET_VERSION_INVALID", error))?;
    let install_path = install_dir.join(cli_executable_name());
    let is_installed = fs::symlink_metadata(&install_path)
        .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
        .unwrap_or(false);
    let installed_version = is_installed
        .then(|| probe_cli_version(&install_path, CLI_VERSION_PROBE_TIMEOUT).ok())
        .flatten();
    let state = classify_cli_state(is_installed, installed_version.as_ref(), &target_version);
    let is_on_path = path_env
        .map(|path| is_directory_on_path(install_dir, path))
        .unwrap_or(false);

    Ok(CliInstallStatus {
        executable_name: cli_executable_name().to_string(),
        install_command: cli_install_command().to_string(),
        install_dir: install_dir.display().to_string(),
        install_path: install_path.display().to_string(),
        installed_version: installed_version.map(|version| version.to_string()),
        is_installed,
        is_on_path,
        platform_supported,
        state,
        target_version: target_version.to_string(),
    })
}

pub fn install_verified_binary(
    binary: &[u8],
    checksum_text: &str,
    install_dir: &Path,
    executable_name: &str,
) -> Result<(), String> {
    install_verified_binary_with(binary, checksum_text, install_dir, executable_name, |_| {
        Ok(())
    })
}

pub async fn install_cli_release(
    release_client: &CliReleaseClient,
    install_dir: &Path,
    path_env: Option<&str>,
    target_version_text: &str,
    asset_name: Option<&str>,
) -> Result<CliInstallStatus, String> {
    let target_version = Version::parse(target_version_text)
        .map_err(|error| cli_error("CLI_TARGET_VERSION_INVALID", error))?;
    let asset_name = asset_name.ok_or_else(|| {
        cli_error(
            "CLI_UNSUPPORTED_PLATFORM",
            "the current platform has no published mclip-cli asset",
        )
    })?;
    let (binary, checksum) = release_client
        .download_release(&target_version, asset_name)
        .await?;
    let install_dir_for_write = install_dir.to_path_buf();
    let executable_name = cli_executable_name().to_string();
    let expected_version = target_version.clone();

    tauri::async_runtime::spawn_blocking(move || {
        install_verified_binary_with(
            &binary,
            &checksum,
            &install_dir_for_write,
            &executable_name,
            |candidate_path| {
                let candidate_version =
                    probe_cli_version(candidate_path, CLI_VERSION_PROBE_TIMEOUT).map_err(|error| {
                        cli_error(
                            "CLI_POST_INSTALL_VERIFY_FAILED",
                            format!("downloaded CLI version probe failed: {error}"),
                        )
                    })?;

                if candidate_version != expected_version {
                    return Err(cli_error(
                        "CLI_POST_INSTALL_VERIFY_FAILED",
                        format!(
                            "downloaded CLI reported {candidate_version}, expected {expected_version}"
                        ),
                    ));
                }

                Ok(())
            },
        )
    })
    .await
    .map_err(|error| cli_error("CLI_REPLACE_FAILED", error))??;

    let status = cli_status_from_install_dir(install_dir, path_env, target_version_text, true)?;

    if status.state != CliInstallState::Current {
        return Err(cli_error(
            "CLI_POST_INSTALL_VERIFY_FAILED",
            "installed CLI did not report the desktop target version",
        ));
    }

    Ok(status)
}

fn install_verified_binary_with<F>(
    binary: &[u8],
    checksum_text: &str,
    install_dir: &Path,
    executable_name: &str,
    validate_candidate: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> Result<(), String>,
{
    let expected_checksum = parse_checksum(checksum_text)?;
    let actual_checksum = sha256_hex(binary);

    if actual_checksum != expected_checksum {
        return Err(cli_error(
            "CLI_CHECKSUM_MISMATCH",
            format!("expected {expected_checksum}, got {actual_checksum}"),
        ));
    }

    fs::create_dir_all(install_dir).map_err(|error| cli_error("CLI_REPLACE_FAILED", error))?;
    let install_path = install_dir.join(executable_name);

    if let Ok(metadata) = fs::symlink_metadata(&install_path) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(cli_error(
                "CLI_DESTINATION_UNSAFE",
                format!("{} is not a regular file", install_path.display()),
            ));
        }
    }

    let unique = unique_install_suffix()?;
    let temp_path = install_dir.join(format!(".{executable_name}.download-{unique}"));
    let backup_path = install_dir.join(format!(".{executable_name}.backup-{unique}"));
    let mut temp_file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|error| cli_error("CLI_REPLACE_FAILED", error))?;

    if let Err(error) = temp_file
        .write_all(binary)
        .and_then(|_| temp_file.sync_all())
    {
        let _ = fs::remove_file(&temp_path);
        return Err(cli_error("CLI_REPLACE_FAILED", error));
    }

    drop(temp_file);

    if let Err(error) = make_executable(&temp_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(cli_error("CLI_REPLACE_FAILED", error));
    }

    if let Err(error) = validate_candidate(&temp_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    replace_file_with(&temp_path, &install_path, &backup_path, |from, to| {
        fs::rename(from, to)
    })
}

fn replace_file_with<F>(
    temp_path: &Path,
    install_path: &Path,
    backup_path: &Path,
    mut rename: F,
) -> Result<(), String>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    let had_existing = install_path.exists();

    if had_existing {
        if let Err(error) = rename(install_path, backup_path) {
            let _ = fs::remove_file(temp_path);
            return Err(cli_error("CLI_REPLACE_FAILED", error));
        }
    }

    if let Err(replace_error) = rename(temp_path, install_path) {
        let restore_error = if had_existing {
            rename(backup_path, install_path).err()
        } else {
            None
        };
        let _ = fs::remove_file(temp_path);

        return Err(cli_error(
            "CLI_REPLACE_FAILED",
            match restore_error {
                Some(restore_error) => format!(
                    "replacement failed: {replace_error}; restoring previous CLI failed: {restore_error}"
                ),
                None => format!("replacement failed: {replace_error}"),
            },
        ));
    }

    if had_existing {
        let _ = fs::remove_file(backup_path);
    }

    Ok(())
}

async fn current_cli_install_status(target_version: String) -> Result<CliInstallStatus, String> {
    let install_dir = default_install_dir()?;
    let path_env = env::var("PATH").ok();
    let platform_supported = release_asset_for_current_platform().is_some();

    tauri::async_runtime::spawn_blocking(move || {
        cli_status_from_install_dir(
            &install_dir,
            path_env.as_deref(),
            &target_version,
            platform_supported,
        )
    })
    .await
    .map_err(|error| cli_error("CLI_STATUS_FAILED", error))?
}

fn runtime_release_client() -> Result<CliReleaseClient, String> {
    #[cfg(debug_assertions)]
    if let Some(base_url) = env::var_os("MCLIP_CLI_RELEASE_BASE_URL") {
        return CliReleaseClient::new(base_url.to_string_lossy());
    }

    CliReleaseClient::github()
}

fn default_install_dir() -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    if let Some(path) = env::var_os("MCLIP_CLI_INSTALL_DIR") {
        return Ok(PathBuf::from(path));
    }

    #[cfg(target_os = "windows")]
    {
        env::var_os("LOCALAPPDATA")
            .or_else(|| env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .map(|base| base.join("mclip").join("bin"))
            .ok_or_else(|| {
                cli_error(
                    "CLI_INSTALL_DIR_UNAVAILABLE",
                    "failed to locate a user install directory",
                )
            })
    }

    #[cfg(not(target_os = "windows"))]
    {
        env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join(".local").join("bin"))
            .ok_or_else(|| {
                cli_error(
                    "CLI_INSTALL_DIR_UNAVAILABLE",
                    "failed to locate $HOME for CLI installation",
                )
            })
    }
}

fn unique_install_suffix() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .map_err(|error| cli_error("CLI_REPLACE_FAILED", error))
}

fn is_directory_on_path(install_dir: &Path, path_env: &str) -> bool {
    env::split_paths(&OsString::from(path_env)).any(|path_dir| same_path(&path_dir, install_dir))
}

fn same_path(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

fn cli_error(code: &str, message: impl std::fmt::Display) -> String {
    format!("{code}: {message}")
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)
        .map_err(|error| error.to_string())?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpListener;

    fn unique_temp_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!(
            "mclip-cli-{name}-{}",
            unique_install_suffix().unwrap()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[cfg(unix)]
    fn write_script(dir: &Path, name: &str, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let path = dir.join(name);
        fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).unwrap();
        path
    }

    #[test]
    fn classifies_all_cli_states() {
        let target = Version::parse("0.1.1").unwrap();

        assert_eq!(
            classify_cli_state(false, None, &target),
            CliInstallState::NotInstalled
        );
        assert_eq!(
            classify_cli_state(true, Some(&Version::parse("0.1.0").unwrap()), &target),
            CliInstallState::Outdated
        );
        assert_eq!(
            classify_cli_state(true, Some(&Version::parse("0.1.1").unwrap()), &target),
            CliInstallState::Current
        );
        assert_eq!(
            classify_cli_state(true, Some(&Version::parse("0.2.0").unwrap()), &target),
            CliInstallState::Newer
        );
        assert_eq!(
            classify_cli_state(true, None, &target),
            CliInstallState::Unknown
        );
    }

    #[test]
    fn parses_only_exact_cli_version_output() {
        assert_eq!(
            parse_cli_version_output(b"mclip-cli 0.1.1\n").unwrap(),
            Version::parse("0.1.1").unwrap()
        );
        assert!(parse_cli_version_output(b"0.1.1\n").is_err());
        assert!(parse_cli_version_output(b"mclip-cli latest\n").is_err());
        assert!(parse_cli_version_output(b"mclip-cli 0.1.1 extra\n").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn probes_success_nonzero_malformed_and_timeout_binaries() {
        let dir = unique_temp_dir("probe");
        let success = write_script(&dir, "success", "printf 'mclip-cli 0.1.1\\n'");
        let nonzero = write_script(&dir, "nonzero", "exit 2");
        let malformed = write_script(&dir, "malformed", "printf 'old cli\\n'");
        let hanging = write_script(&dir, "hanging", "sleep 5");

        assert_eq!(
            probe_cli_version(&success, Duration::from_secs(5)).unwrap(),
            Version::parse("0.1.1").unwrap()
        );
        assert!(probe_cli_version(&nonzero, Duration::from_secs(5)).is_err());
        assert!(probe_cli_version(&malformed, Duration::from_secs(5)).is_err());
        let started_at = std::time::Instant::now();
        assert!(probe_cli_version(&hanging, Duration::from_millis(50)).is_err());
        assert!(started_at.elapsed() < Duration::from_secs(1));
    }

    #[test]
    fn maps_only_published_desktop_assets() {
        assert_eq!(
            release_asset_name("macos", "aarch64"),
            Some("mclip-cli-darwin-arm64")
        );
        assert_eq!(
            release_asset_name("windows", "x86_64"),
            Some("mclip-cli-windows-x64.exe")
        );
        assert_eq!(release_asset_name("macos", "x86_64"), None);
        assert_eq!(release_asset_name("linux", "x86_64"), None);
    }

    #[test]
    fn builds_release_and_checksum_names() {
        let version = Version::parse("0.1.1").unwrap();
        assert_eq!(
            release_download_url(
                "https://github.com/bells/mclip/releases/",
                &version,
                "mclip-cli-darwin-arm64"
            ),
            "https://github.com/bells/mclip/releases/download/v0.1.1/mclip-cli-darwin-arm64"
        );
        assert_eq!(
            checksum_asset_name("mclip-cli-windows-x64.exe"),
            "mclip-cli-windows-x64.exe.sha256"
        );
    }

    #[test]
    fn parses_and_validates_sha256() {
        let binary = b"verified mclip cli";
        let digest = sha256_hex(binary);
        assert_eq!(
            parse_checksum(&format!("{digest}  mclip-cli-test\n")).unwrap(),
            digest
        );
        assert!(parse_checksum("").is_err());
        assert!(parse_checksum("1234 mclip-cli-test").is_err());
    }

    #[test]
    fn installs_verified_binary_and_preserves_existing_on_mismatch() {
        let install_dir = unique_temp_dir("verified-install");
        let install_path = install_dir.join(cli_executable_name());
        fs::write(&install_path, b"old").unwrap();
        let binary = b"new verified binary";
        let checksum = format!("{}  {}\n", sha256_hex(binary), cli_executable_name());

        install_verified_binary(binary, &checksum, &install_dir, cli_executable_name()).unwrap();
        assert_eq!(fs::read(&install_path).unwrap(), binary);

        let error =
            install_verified_binary(b"tampered", &checksum, &install_dir, cli_executable_name())
                .unwrap_err();
        assert!(error.starts_with("CLI_CHECKSUM_MISMATCH:"));
        assert_eq!(fs::read(&install_path).unwrap(), binary);
    }

    #[cfg(unix)]
    #[test]
    fn verified_install_upgrades_legacy_binary_and_refreshes_to_current() {
        let install_dir = unique_temp_dir("legacy-upgrade");
        let install_path = install_dir.join(cli_executable_name());
        fs::write(&install_path, b"#!/bin/sh\nprintf 'old cli\\n'\n").unwrap();
        make_executable(&install_path).unwrap();
        let before = cli_status_from_install_dir(&install_dir, None, "0.1.1", true).unwrap();
        assert_eq!(before.state, CliInstallState::Unknown);

        let binary = b"#!/bin/sh\nprintf 'mclip-cli 0.1.1\\n'\n";
        install_verified_binary(
            binary,
            &sha256_hex(binary),
            &install_dir,
            cli_executable_name(),
        )
        .unwrap();
        let after = cli_status_from_install_dir(&install_dir, None, "0.1.1", true).unwrap();

        assert_eq!(after.state, CliInstallState::Current);
        assert_eq!(after.installed_version.as_deref(), Some("0.1.1"));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_destination_and_sets_executable_mode() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let install_dir = unique_temp_dir("symlink");
        let target = install_dir.join("target");
        fs::write(&target, b"keep").unwrap();
        symlink(&target, install_dir.join(cli_executable_name())).unwrap();
        let binary = b"verified";
        let checksum = sha256_hex(binary);

        assert!(
            install_verified_binary(binary, &checksum, &install_dir, cli_executable_name())
                .unwrap_err()
                .starts_with("CLI_DESTINATION_UNSAFE:")
        );
        assert_eq!(fs::read(&target).unwrap(), b"keep");

        fs::remove_file(install_dir.join(cli_executable_name())).unwrap();
        install_verified_binary(binary, &checksum, &install_dir, cli_executable_name()).unwrap();
        let mode = fs::metadata(install_dir.join(cli_executable_name()))
            .unwrap()
            .permissions()
            .mode();
        assert_ne!(mode & 0o111, 0);
    }

    #[test]
    fn restores_previous_binary_when_final_rename_fails() {
        let install_dir = unique_temp_dir("rollback");
        let install_path = install_dir.join("mclip-cli");
        let temp_path = install_dir.join("download");
        let backup_path = install_dir.join("backup");
        fs::write(&install_path, b"old").unwrap();
        fs::write(&temp_path, b"new").unwrap();
        let mut calls = 0;

        let error = replace_file_with(&temp_path, &install_path, &backup_path, |from, to| {
            calls += 1;
            if calls == 2 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "in use",
                ));
            }
            fs::rename(from, to)
        })
        .unwrap_err();

        assert!(error.starts_with("CLI_REPLACE_FAILED:"));
        assert_eq!(fs::read(&install_path).unwrap(), b"old");
        assert!(!backup_path.exists());
    }

    #[test]
    fn install_guard_rejects_concurrent_request() {
        let first = CliInstallGuard::acquire().unwrap();
        assert!(CliInstallGuard::acquire()
            .unwrap_err()
            .starts_with("CLI_INSTALL_BUSY:"));
        drop(first);
        assert!(CliInstallGuard::acquire().is_ok());
    }

    #[test]
    fn release_client_downloads_binary_and_checksum_from_same_version() {
        let binary = b"release binary".to_vec();
        let checksum = format!("{}  mclip-cli-test\n", sha256_hex(&binary));
        let listener = match TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                // Codex 的受限文件系统禁止本地监听；普通本机与 CI 仍执行完整下载测试。
                return;
            }
            Err(error) => panic!("fixture server should bind: {error}"),
        };
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            for response_body in [binary, checksum.into_bytes()] {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0_u8; 2048];
                let _ = stream.read(&mut request).unwrap();
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    response_body.len()
                )
                .unwrap();
                stream.write_all(&response_body).unwrap();
            }
        });
        let client = CliReleaseClient::new(format!("http://{address}")).unwrap();
        let version = Version::parse("0.1.1").unwrap();

        let (downloaded, checksum) =
            tauri::async_runtime::block_on(client.download_release(&version, "mclip-cli-test"))
                .unwrap();
        server.join().unwrap();

        assert_eq!(downloaded, b"release binary");
        assert_eq!(parse_checksum(&checksum).unwrap(), sha256_hex(&downloaded));
    }

    #[test]
    fn release_client_reports_unavailable_binary_without_requesting_checksum() {
        let listener = match TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("fixture server should bind: {error}"),
        };
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).unwrap();
            write!(
                stream,
                "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
        });
        let client = CliReleaseClient::new(format!("http://{address}")).unwrap();
        let version = Version::parse("0.1.1").unwrap();

        let error =
            tauri::async_runtime::block_on(client.download_release(&version, "mclip-cli-test"))
                .unwrap_err();
        server.join().unwrap();

        assert!(error.starts_with("CLI_RELEASE_UNAVAILABLE:"));
    }

    #[test]
    fn release_client_rejects_streamed_body_after_size_limit() {
        let listener = match TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("fixture server should bind: {error}"),
        };
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).unwrap();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n\
                 3\r\nabc\r\n3\r\ndef\r\n0\r\n\r\n"
            )
            .unwrap();
        });
        let client = CliReleaseClient::new(format!("http://{address}")).unwrap();

        let error = tauri::async_runtime::block_on(client.download_limited(
            &format!("http://{address}/fixture"),
            5,
            "CLI_RELEASE_UNAVAILABLE",
        ))
        .unwrap_err();
        server.join().unwrap();

        assert!(error.starts_with("CLI_DOWNLOAD_TOO_LARGE:"));
    }
}
