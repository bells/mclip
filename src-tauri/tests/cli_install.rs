use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use m_clip_lib::cli_install::{
    checksum_asset_name, cli_executable_name, cli_install_command, cli_status_from_install_dir,
    install_cli_release, install_verified_binary, release_asset_name, sha256_hex, CliInstallState,
    CliReleaseClient,
};

fn unique_temp_dir(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mclip-cli-install-{name}-{unique}"));
    fs::create_dir_all(&dir).expect("fixture directory should be created");
    dir
}

fn executable_path(dir: &Path) -> PathBuf {
    dir.join(cli_executable_name())
}

fn spawn_release_server(
    responses: Vec<(u16, Vec<u8>)>,
) -> Option<(String, thread::JoinHandle<()>)> {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("fixture server should bind: {error}"),
    };
    let address = listener
        .local_addr()
        .expect("fixture address should resolve");
    let server = thread::spawn(move || {
        for (status, response_body) in responses {
            let (mut stream, _) = listener.accept().expect("fixture request should arrive");
            let mut request = [0_u8; 2048];
            let _ = stream
                .read(&mut request)
                .expect("request should be readable");
            let reason = if status == 200 { "OK" } else { "Not Found" };
            write!(
                stream,
                "HTTP/1.1 {status} {reason}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                response_body.len()
            )
            .expect("fixture headers should be written");
            stream
                .write_all(&response_body)
                .expect("fixture body should be written");
        }
    });

    Some((format!("http://{address}"), server))
}

fn current_cli_binary() -> Vec<u8> {
    fs::read(env!("CARGO_BIN_EXE_mclip-cli")).expect("built CLI fixture should be readable")
}

fn checksum_for(binary: &[u8]) -> Vec<u8> {
    format!("{}  fixture\n", sha256_hex(binary)).into_bytes()
}

#[test]
fn cli_status_reports_missing_binary_and_path_visibility() {
    let install_dir = unique_temp_dir("status");
    let status = cli_status_from_install_dir(
        &install_dir,
        Some(install_dir.to_string_lossy().as_ref()),
        "0.1.1",
        true,
    )
    .expect("status should be created");

    assert_eq!(status.state, CliInstallState::NotInstalled);
    assert!(!status.is_installed);
    assert!(status.is_on_path);
    assert!(status.platform_supported);
    assert_eq!(status.installed_version, None);
    assert_eq!(status.target_version, "0.1.1");
    assert_eq!(
        status.install_path,
        executable_path(&install_dir).display().to_string()
    );
    assert!(status.install_command.contains("curl -fsSL"));
}

#[test]
fn install_verified_binary_replaces_existing_binary() {
    let install_dir = unique_temp_dir("install");
    let installed_path = executable_path(&install_dir);
    fs::write(&installed_path, "old cli").expect("old fixture should be written");
    let binary = b"verified cli";
    let checksum = format!("{}  {}\n", sha256_hex(binary), cli_executable_name());

    install_verified_binary(binary, &checksum, &install_dir, cli_executable_name())
        .expect("install should succeed");

    assert_eq!(fs::read(&installed_path).unwrap(), binary);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mode = fs::metadata(&installed_path).unwrap().permissions().mode();
        assert_ne!(mode & 0o111, 0, "installed binary should be executable");
    }
}

#[test]
fn release_asset_contract_matches_current_workflow() {
    assert_eq!(
        release_asset_name("macos", "aarch64"),
        Some("mclip-cli-darwin-arm64")
    );
    assert_eq!(
        release_asset_name("windows", "x86_64"),
        Some("mclip-cli-windows-x64.exe")
    );
    assert_eq!(
        checksum_asset_name("mclip-cli-windows-x64.exe"),
        "mclip-cli-windows-x64.exe.sha256"
    );
}

#[test]
fn cli_install_command_points_to_public_script() {
    assert_eq!(
        cli_install_command(),
        "curl -fsSL https://www.mclip.cn/install.sh | sh"
    );
}

#[test]
fn release_install_upgrades_legacy_binary_and_refreshes_to_current() {
    let install_dir = unique_temp_dir("release-success");
    let install_path = executable_path(&install_dir);
    fs::write(&install_path, b"legacy cli without version support")
        .expect("legacy fixture should be written");
    let binary = current_cli_binary();
    let Some((base_url, server)) =
        spawn_release_server(vec![(200, binary.clone()), (200, checksum_for(&binary))])
    else {
        return;
    };
    let client = CliReleaseClient::new(base_url).expect("fixture client should build");

    let status = tauri::async_runtime::block_on(install_cli_release(
        &client,
        &install_dir,
        None,
        env!("CARGO_PKG_VERSION"),
        Some("mclip-cli-fixture"),
    ))
    .expect("verified release install should succeed");
    server.join().expect("fixture server should finish");

    assert_eq!(status.state, CliInstallState::Current);
    assert_eq!(
        status.installed_version.as_deref(),
        Some(env!("CARGO_PKG_VERSION"))
    );
    assert_eq!(fs::read(install_path).unwrap(), binary);
}

#[test]
fn release_install_preserves_existing_binary_on_checksum_failure() {
    let install_dir = unique_temp_dir("release-checksum");
    let install_path = executable_path(&install_dir);
    fs::write(&install_path, b"old cli").expect("old fixture should be written");
    let binary = current_cli_binary();
    let Some((base_url, server)) = spawn_release_server(vec![
        (200, binary),
        (200, format!("{:064x}\n", 0).into_bytes()),
    ]) else {
        return;
    };
    let client = CliReleaseClient::new(base_url).expect("fixture client should build");

    let error = tauri::async_runtime::block_on(install_cli_release(
        &client,
        &install_dir,
        None,
        env!("CARGO_PKG_VERSION"),
        Some("mclip-cli-fixture"),
    ))
    .expect_err("checksum mismatch should fail closed");
    server.join().expect("fixture server should finish");

    assert!(error.starts_with("CLI_CHECKSUM_MISMATCH:"));
    assert_eq!(fs::read(install_path).unwrap(), b"old cli");
}

#[test]
fn release_install_reports_network_and_unpublished_asset_failures() {
    let install_dir = unique_temp_dir("release-errors");
    let unavailable_path = executable_path(&install_dir);
    fs::write(&unavailable_path, b"old cli").expect("old fixture should be written");
    let Some((base_url, server)) = spawn_release_server(vec![(404, Vec::new())]) else {
        return;
    };
    let unavailable_client = CliReleaseClient::new(base_url).expect("fixture client should build");

    let unavailable_error = tauri::async_runtime::block_on(install_cli_release(
        &unavailable_client,
        &install_dir,
        None,
        env!("CARGO_PKG_VERSION"),
        Some("missing-cli-fixture"),
    ))
    .expect_err("missing release asset should fail");
    server.join().expect("fixture server should finish");
    assert!(unavailable_error.starts_with("CLI_RELEASE_UNAVAILABLE:"));
    assert_eq!(fs::read(&unavailable_path).unwrap(), b"old cli");

    let closed_listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
        Err(error) => panic!("closed port should bind: {error}"),
    };
    let closed_address = closed_listener
        .local_addr()
        .expect("closed address should resolve");
    drop(closed_listener);
    let network_client = CliReleaseClient::new(format!("http://{closed_address}"))
        .expect("network client should build");
    let network_error = tauri::async_runtime::block_on(install_cli_release(
        &network_client,
        &install_dir,
        None,
        env!("CARGO_PKG_VERSION"),
        Some("mclip-cli-fixture"),
    ))
    .expect_err("network failure should be reported");

    assert!(network_error.starts_with("CLI_DOWNLOAD_FAILED:"));
    assert_eq!(fs::read(unavailable_path).unwrap(), b"old cli");
}

#[test]
fn release_install_rejects_unsupported_platform_without_downloading() {
    let install_dir = unique_temp_dir("release-unsupported");
    let client = CliReleaseClient::new("http://127.0.0.1:1").expect("fixture client should build");

    let error = tauri::async_runtime::block_on(install_cli_release(
        &client,
        &install_dir,
        None,
        env!("CARGO_PKG_VERSION"),
        None,
    ))
    .expect_err("unsupported platform should fail before download");

    assert!(error.starts_with("CLI_UNSUPPORTED_PLATFORM:"));
    assert!(!executable_path(&install_dir).exists());
}

#[test]
fn release_install_verifies_candidate_version_before_replacing_existing_cli() {
    let install_dir = unique_temp_dir("release-post-verify");
    let install_path = executable_path(&install_dir);
    fs::write(&install_path, b"old cli").expect("old fixture should be written");
    let binary = current_cli_binary();
    let Some((base_url, server)) =
        spawn_release_server(vec![(200, binary.clone()), (200, checksum_for(&binary))])
    else {
        return;
    };
    let client = CliReleaseClient::new(base_url).expect("fixture client should build");

    let error = tauri::async_runtime::block_on(install_cli_release(
        &client,
        &install_dir,
        None,
        "0.1.2",
        Some("mclip-cli-fixture"),
    ))
    .expect_err("wrong release binary version should fail before replacement");
    server.join().expect("fixture server should finish");

    assert!(error.starts_with("CLI_POST_INSTALL_VERIFY_FAILED:"));
    assert_eq!(fs::read(install_path).unwrap(), b"old cli");
}
