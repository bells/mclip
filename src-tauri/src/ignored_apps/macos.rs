use std::path::Path;

use base64::Engine;
use objc2::rc::autoreleasepool;
use objc2::AnyThread;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
use objc2_foundation::{NSBundle, NSDictionary, NSPoint, NSRect, NSSize, NSString};

use super::{application, SourceApplicationOption};

pub(super) fn selected_application(path: &Path) -> Result<SourceApplicationOption, &'static str> {
    if !path.is_dir()
        || !path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
    {
        return Err("applicationSelectionInvalid");
    }
    autoreleasepool(|_| {
        let path_string = NSString::from_str(path.to_str().ok_or("applicationSelectionInvalid")?);
        let bundle = NSBundle::bundleWithPath(&path_string).ok_or("applicationSelectionInvalid")?;
        let bundle_id = bundle
            .bundleIdentifier()
            .ok_or("applicationSelectionInvalid")?;
        let name = ["CFBundleDisplayName", "CFBundleName"]
            .iter()
            .find_map(|key| {
                bundle
                    .objectForInfoDictionaryKey(&NSString::from_str(key))?
                    .downcast_ref::<NSString>()
                    .map(|value| value.to_string())
                    .filter(|value| !value.trim().is_empty())
            })
            .or_else(|| {
                path.file_stem()
                    .map(|name| name.to_string_lossy().into_owned())
            })
            .ok_or("applicationSelectionInvalid")?;
        let mut app = application(format!("macos:{bundle_id}"), name)?;
        app.icon_data_url = icon_data_url(&path_string);
        Ok(app)
    })
}

pub(super) fn resolve_application(id: &str) -> Option<SourceApplicationOption> {
    autoreleasepool(|_| {
        let bundle_id = id.strip_prefix("macos:")?;
        if let Some(url) = NSWorkspace::sharedWorkspace()
            .URLForApplicationWithBundleIdentifier(&NSString::from_str(bundle_id))
        {
            if let Some(path) = url.path() {
                if let Ok(app) = selected_application(Path::new(&path.to_string())) {
                    if app.id == id {
                        return Some(app);
                    }
                }
            }
        }
        // Saved identifiers are lowercase; Launch Services can require the original case.
        // Bound the fallback to application directories, never a whole-disk search.
        let mut roots = vec![
            std::path::PathBuf::from("/Applications"),
            std::path::PathBuf::from("/System/Applications"),
        ];
        if let Some(home) = std::env::var_os("HOME") {
            roots.push(std::path::PathBuf::from(home).join("Applications"));
        }
        let mut budget = 2048;
        roots
            .iter()
            .find_map(|root| find_application(root, bundle_id, 2, &mut budget))
    })
}

fn find_application(
    root: &Path,
    bundle_id: &str,
    depth: usize,
    budget: &mut usize,
) -> Option<SourceApplicationOption> {
    for entry in std::fs::read_dir(root).ok()?.flatten() {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let path = entry.path();
        if path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
        {
            let Some(text) = path.to_str() else {
                continue;
            };
            let Some(bundle) = NSBundle::bundleWithPath(&NSString::from_str(text)) else {
                continue;
            };
            if bundle
                .bundleIdentifier()
                .is_some_and(|value| value.to_string().eq_ignore_ascii_case(bundle_id))
            {
                return selected_application(&path).ok();
            }
        } else if depth > 0 && path.is_dir() {
            if let Some(app) = find_application(&path, bundle_id, depth - 1, budget) {
                return Some(app);
            }
        }
    }
    None
}

fn icon_data_url(path: &NSString) -> Option<String> {
    let image = NSWorkspace::sharedWorkspace().iconForFile(path);
    let mut rect = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(32.0, 32.0));
    // System icons may use a private representation rather than NSBitmapImageRep.
    // Render through CGImage; the rectangle is valid for this synchronous call.
    let cg_image = unsafe { image.CGImageForProposedRect_context_hints(&mut rect, None, None) }?;
    let bitmap = NSBitmapImageRep::initWithCGImage(NSBitmapImageRep::alloc(), &cg_image);
    // An empty property dictionary uses AppKit's PNG defaults and has no untyped values.
    let png = unsafe {
        bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
    }?;
    if png.len() > 128 * 1024 {
        return None;
    }
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png.to_vec())
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installed_application_metadata_matches_existing_source_identity() {
        let app = selected_application(Path::new("/System/Applications/TextEdit.app")).unwrap();
        assert_eq!(app.id, "macos:com.apple.textedit");
        assert!(!app.display_name.is_empty());
        assert!(app
            .icon_data_url
            .as_deref()
            .is_some_and(|icon| icon.starts_with("data:image/png;base64,")));
        assert_eq!(resolve_application(&app.id).unwrap().id, app.id);
    }

    #[test]
    fn rejects_non_application_selection_without_path_in_error() {
        assert_eq!(
            selected_application(Path::new("/System/Applications")).unwrap_err(),
            "applicationSelectionInvalid"
        );
    }
}
