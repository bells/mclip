use super::{application, SourceApplicationOption};

#[cfg(target_os = "linux")]
pub(super) fn selected_application(
    path: &std::path::Path,
) -> Result<SourceApplicationOption, &'static str> {
    use std::io::Read;
    if !path.extension().is_some_and(|ext| ext == "desktop") {
        return Err("applicationSelectionInvalid");
    }
    let file = std::fs::File::open(path).map_err(|_| "applicationSelectionInvalid")?;
    if !file
        .metadata()
        .map_err(|_| "applicationSelectionInvalid")?
        .is_file()
    {
        return Err("applicationSelectionInvalid");
    }
    let mut text = String::new();
    file.take(65_537)
        .read_to_string(&mut text)
        .map_err(|_| "applicationSelectionInvalid")?;
    if text.len() > 65_536 {
        return Err("applicationSelectionInvalid");
    }
    parse_desktop_entry(&text)
}

fn parse_desktop_entry(text: &str) -> Result<SourceApplicationOption, &'static str> {
    let mut in_entry = false;
    let (mut name, mut class, mut kind) = (None, None, None);
    for line in text.lines().map(str::trim) {
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_entry || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key.trim() {
            "Name" => name = Some(value.trim()),
            "StartupWMClass" => class = Some(value.trim()),
            "Type" => kind = Some(value.trim()),
            _ => {}
        }
    }
    if kind != Some("Application") {
        return Err("applicationSelectionInvalid");
    }
    let class = class
        .filter(|value| !value.is_empty())
        .ok_or("applicationIdentityUnavailable")?;
    application(
        format!("x11:{class}"),
        name.ok_or("applicationSelectionInvalid")?.into(),
    )
}

#[cfg(target_os = "linux")]
pub(super) fn resolve_application(id: &str) -> Option<SourceApplicationOption> {
    if !id.starts_with("x11:") {
        return None;
    }
    let mut dirs = vec![
        std::path::PathBuf::from("/usr/share/applications"),
        std::path::PathBuf::from("/usr/local/share/applications"),
    ];
    if let Some(data) = std::env::var_os("XDG_DATA_HOME") {
        dirs.push(std::path::PathBuf::from(data).join("applications"));
    } else if let Some(home) = std::env::var_os("HOME") {
        dirs.push(std::path::PathBuf::from(home).join(".local/share/applications"));
    }
    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.take(1024).flatten() {
            if let Ok(app) = selected_application(&entry.path()) {
                if app.id == id {
                    return Some(app);
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_explicit_class_and_ignores_launcher_commands() {
        let app = parse_desktop_entry("[Desktop Entry]\nType=Application\nName=Example App\nStartupWMClass=ExampleApp\nExec=sh -c unsafe\n[Desktop Action Other]\nName=Other\nStartupWMClass=Wrong").unwrap();
        assert_eq!(app.id, "x11:exampleapp");
        assert_eq!(app.display_name, "Example App");
    }

    #[test]
    fn never_guesses_identity_from_exec_or_filename() {
        assert_eq!(
            parse_desktop_entry("[Desktop Entry]\nType=Application\nName=Example\nExec=example")
                .unwrap_err(),
            "applicationIdentityUnavailable"
        );
        assert!(parse_desktop_entry(
            "[Desktop Entry]\nType=Link\nName=Example\nStartupWMClass=Example"
        )
        .is_err());
    }
}
