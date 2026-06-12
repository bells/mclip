use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use m_clip_lib::cli_install::{
    cli_install_command, cli_status_from_install_dir, install_cli_from_source,
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
    dir.join(if cfg!(windows) {
        "mclip-cli.exe"
    } else {
        "mclip-cli"
    })
}

#[test]
fn cli_status_reports_installed_binary_and_path_visibility() {
    let install_dir = unique_temp_dir("status");
    fs::write(executable_path(&install_dir), "fake cli").expect("fixture binary should be written");

    let status = cli_status_from_install_dir(
        &install_dir,
        Some(install_dir.to_string_lossy().as_ref()),
        true,
    );

    assert!(status.is_installed);
    assert!(status.is_on_path);
    assert!(status.source_available);
    assert_eq!(
        status.executable_name,
        executable_path(Path::new("")).display().to_string()
    );
    assert_eq!(
        status.install_path,
        executable_path(&install_dir).display().to_string()
    );
    assert!(status.install_command.contains("curl -fsSL"));
    assert!(status.install_command.contains("install.sh"));
}

#[test]
fn install_cli_from_source_copies_binary_into_install_dir() {
    let source_dir = unique_temp_dir("source");
    let install_dir = unique_temp_dir("install");
    let source = executable_path(&source_dir);
    fs::write(&source, "fake cli").expect("source binary should be written");

    let status = install_cli_from_source(&source, &install_dir).expect("install should succeed");
    let installed_path = executable_path(&install_dir);

    assert_eq!(fs::read_to_string(&installed_path).unwrap(), "fake cli");
    assert!(status.is_installed);
    assert_eq!(status.install_path, installed_path.display().to_string());

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mode = fs::metadata(&installed_path).unwrap().permissions().mode();
        assert_ne!(mode & 0o111, 0, "installed binary should be executable");
    }
}

#[test]
fn cli_install_command_points_to_public_script() {
    assert_eq!(
        cli_install_command(),
        "curl -fsSL https://mclip.vercel.app/install.sh | sh"
    );
}
