use arboard::Clipboard;
use std::thread;
use std::time::Duration;
use tauri::AppHandle;

use crate::history::{emit_history_updated, process_new_history_item};

const CLIPBOARD_POLL_INTERVAL_MS: u64 = 500;

#[tauri::command]
pub fn copy_to_clipboard(content: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(content)
        .map_err(|error| error.to_string())
}

fn open_clipboard() -> Option<Clipboard> {
    Clipboard::new().ok()
}

pub fn spawn_clipboard_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut clipboard = open_clipboard();
        let mut last_content = clipboard
            .as_mut()
            .and_then(|handle| handle.get_text().ok())
            .unwrap_or_default();

        loop {
            if clipboard.is_none() {
                clipboard = open_clipboard();
            }

            if let Some(handle) = clipboard.as_mut() {
                match handle.get_text() {
                    Ok(current_content)
                        if !current_content.is_empty() && current_content != last_content =>
                    {
                        last_content = current_content.clone();

                        match process_new_history_item(&app_handle, &current_content) {
                            Ok(updated_history) => {
                                if let Err(error) =
                                    emit_history_updated(&app_handle, &updated_history)
                                {
                                    eprintln!("failed to emit history update: {error}");
                                }
                            }
                            Err(error) => {
                                eprintln!("failed to process clipboard history: {error}");
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(_) => {
                        clipboard = None;
                    }
                }
            }

            thread::sleep(Duration::from_millis(CLIPBOARD_POLL_INTERVAL_MS));
        }
    });
}
