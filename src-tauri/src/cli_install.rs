//! mclip-cli 的本地安装检测与安装入口。
//! 第一版只做本机用户目录安装，不触碰需要管理员权限的系统目录。

use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

const CLI_INSTALL_COMMAND: &str = "curl -fsSL https://mclip.vercel.app/install.sh | sh";
const MCLIP_REPO_URL: &str = "https://github.com/bells/mclip.git";
const MCLIP_REPO_REF: &str = "main";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstallStatus {
    pub executable_name: String,
    pub install_command: String,
    pub install_dir: String,
    pub install_path: String,
    pub is_installed: bool,
    pub is_on_path: bool,
    pub source_available: bool,
}

#[tauri::command]
pub fn get_cli_install_status() -> Result<CliInstallStatus, String> {
    current_cli_install_status()
}

#[tauri::command]
pub fn install_cli() -> Result<CliInstallStatus, String> {
    let install_dir = default_install_dir()?;

    if let Some(source_path) = find_cli_source() {
        return install_cli_from_source(&source_path, &install_dir);
    }

    if let Some(source_path) = build_cli_from_local_manifest()? {
        return install_cli_from_source(&source_path, &install_dir);
    }

    install_cli_from_remote_repo(&install_dir)
}

pub fn cli_install_command() -> &'static str {
    CLI_INSTALL_COMMAND
}

pub fn cli_status_from_install_dir(
    install_dir: &Path,
    path_env: Option<&str>,
    source_available: bool,
) -> CliInstallStatus {
    let install_path = install_dir.join(cli_executable_name());
    let is_installed = install_path.is_file();
    let is_on_path = path_env
        .map(|path| is_directory_on_path(install_dir, path))
        .unwrap_or(false);

    CliInstallStatus {
        executable_name: cli_executable_name().to_string(),
        install_command: cli_install_command().to_string(),
        install_dir: install_dir.display().to_string(),
        install_path: install_path.display().to_string(),
        is_installed,
        is_on_path,
        source_available,
    }
}

pub fn install_cli_from_source(
    source_path: &Path,
    install_dir: &Path,
) -> Result<CliInstallStatus, String> {
    if !source_path.is_file() {
        return Err(format!(
            "mclip-cli source binary does not exist: {}",
            source_path.display()
        ));
    }

    fs::create_dir_all(install_dir).map_err(|error| error.to_string())?;
    let install_path = install_dir.join(cli_executable_name());

    if !same_path(source_path, &install_path) {
        fs::copy(source_path, &install_path).map_err(|error| error.to_string())?;
    }

    make_executable(&install_path)?;

    Ok(cli_status_from_install_dir(
        install_dir,
        env::var("PATH").ok().as_deref(),
        true,
    ))
}

fn current_cli_install_status() -> Result<CliInstallStatus, String> {
    let install_dir = default_install_dir()?;
    let source_available = install_source_available();

    Ok(cli_status_from_install_dir(
        &install_dir,
        env::var("PATH").ok().as_deref(),
        source_available,
    ))
}

fn install_source_available() -> bool {
    find_cli_source().is_some()
        || local_manifest_path().is_some()
        || (command_exists("cargo") && command_exists("git"))
}

fn find_cli_source() -> Option<PathBuf> {
    cli_source_candidates()
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn build_cli_from_local_manifest() -> Result<Option<PathBuf>, String> {
    let Some(manifest_path) = local_manifest_path() else {
        return Ok(None);
    };

    build_cli_from_manifest(&manifest_path).map(Some)
}

fn build_cli_from_manifest(manifest_path: &Path) -> Result<PathBuf, String> {
    let manifest_arg = manifest_path.display().to_string();

    let output = Command::new("cargo")
        .args([
            "build",
            "--manifest-path",
            &manifest_arg,
            "--bin",
            "mclip-cli",
        ])
        .output()
        .map_err(|error| format!("failed to run cargo build: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("failed to build mclip-cli: {stderr}"));
    }

    Ok(manifest_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("target")
        .join("debug")
        .join(cli_executable_name()))
}

fn install_cli_from_remote_repo(install_dir: &Path) -> Result<CliInstallStatus, String> {
    if !command_exists("cargo") {
        return Err("cargo is required to build mclip-cli from source".to_string());
    }

    if !command_exists("git") {
        return Err("git is required to fetch mclip source".to_string());
    }

    let temp_dir = unique_temp_dir()?;
    let repo_dir = temp_dir.join("mclip");
    let repo_dir_arg = repo_dir.display().to_string();
    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            "--branch",
            MCLIP_REPO_REF,
            MCLIP_REPO_URL,
            &repo_dir_arg,
        ])
        .output()
        .map_err(|error| format!("failed to run git clone: {error}"))?;

    if !output.status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(format!(
            "failed to fetch mclip source: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let manifest_path = repo_dir.join("src-tauri").join("Cargo.toml");
    let source_path = match build_cli_from_manifest(&manifest_path) {
        Ok(source_path) => source_path,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(error);
        }
    };
    let status = install_cli_from_source(&source_path, install_dir);
    let _ = fs::remove_dir_all(&temp_dir);
    status
}

fn local_manifest_path() -> Option<PathBuf> {
    let current_dir = env::current_dir().ok()?;
    let candidates = [
        current_dir.join("src-tauri").join("Cargo.toml"),
        current_dir.join("Cargo.toml"),
    ];

    candidates.into_iter().find(|path| path.is_file())
}

fn command_exists(command: &str) -> bool {
    Command::new(command)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn unique_temp_dir() -> Result<PathBuf, String> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let dir = env::temp_dir().join(format!("mclip-cli-install-{unique}"));
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn cli_source_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(path) = env::var_os("MCLIP_CLI_SOURCE") {
        candidates.push(PathBuf::from(path));
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join(cli_executable_name()));
        }

        #[cfg(target_os = "macos")]
        if let Some(resources_dir) = macos_bundle_resources_dir(&current_exe) {
            candidates.push(resources_dir.join(cli_executable_name()));
        }
    }

    if let Ok(current_dir) = env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("target")
                .join("release")
                .join(cli_executable_name()),
        );
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("target")
                .join("debug")
                .join(cli_executable_name()),
        );
        candidates.push(
            current_dir
                .join("target")
                .join("release")
                .join(cli_executable_name()),
        );
        candidates.push(
            current_dir
                .join("target")
                .join("debug")
                .join(cli_executable_name()),
        );
    }

    candidates
}

#[cfg(target_os = "macos")]
fn macos_bundle_resources_dir(current_exe: &Path) -> Option<PathBuf> {
    let macos_dir = current_exe.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }

    Some(macos_dir.parent()?.join("Resources"))
}

fn default_install_dir() -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("MCLIP_CLI_INSTALL_DIR") {
        return Ok(PathBuf::from(path));
    }

    #[cfg(target_os = "windows")]
    {
        env::var_os("LOCALAPPDATA")
            .or_else(|| env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .map(|base| base.join("mclip").join("bin"))
            .ok_or_else(|| "failed to locate a user install directory".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join(".local").join("bin"))
            .ok_or_else(|| "failed to locate $HOME for CLI installation".to_string())
    }
}

fn cli_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "mclip-cli.exe"
    } else {
        "mclip-cli"
    }
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
