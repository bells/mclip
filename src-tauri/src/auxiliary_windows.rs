//! 按需创建辅助 WebView，并协调前端 listener ready 生命周期。

use std::path::PathBuf;
use std::time::Duration;

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::auxiliary_window_contract::EnsureReservation;
pub use crate::auxiliary_window_contract::{
    auxiliary_window_descriptor, AuxiliaryWindowDescriptor, AuxiliaryWindowRegistry,
    LogicalWindowSize, MacosCornerBehavior, AUXILIARY_WINDOW_DESCRIPTORS,
};

const AUXILIARY_READY_TIMEOUT: Duration = Duration::from_secs(8);

fn build_auxiliary_window(
    app_handle: &AppHandle,
    descriptor: &AuxiliaryWindowDescriptor,
    generation: u64,
) -> Result<WebviewWindow, String> {
    let url = format!("{}?mclipWindowGeneration={generation}", descriptor.url);
    let mut builder = WebviewWindowBuilder::new(
        app_handle,
        descriptor.label,
        WebviewUrl::App(PathBuf::from(url)),
    )
    .title(descriptor.title)
    .inner_size(descriptor.size.width, descriptor.size.height)
    .transparent(descriptor.transparent)
    .focusable(descriptor.focusable)
    .resizable(descriptor.resizable)
    .maximizable(descriptor.maximizable)
    .minimizable(descriptor.minimizable)
    .decorations(descriptor.decorations)
    .always_on_top(descriptor.always_on_top)
    .skip_taskbar(descriptor.skip_taskbar)
    .shadow(descriptor.shadow)
    .visible(false);

    if let Some(min_size) = descriptor.min_size {
        builder = builder.min_inner_size(min_size.width, min_size.height);
    }
    if let Some(max_size) = descriptor.max_size {
        builder = builder.max_inner_size(max_size.width, max_size.height);
    }

    let window = builder.build().map_err(|error| error.to_string())?;
    if descriptor.macos_corner_behavior == MacosCornerBehavior::Rounded {
        crate::window::apply_auxiliary_window_corner_radius(app_handle, descriptor.label);
    }
    Ok(window)
}

pub async fn ensure_auxiliary_window_ready(
    app_handle: &AppHandle,
    label: &str,
) -> Result<u64, String> {
    let descriptor = auxiliary_window_descriptor(label)
        .ok_or_else(|| format!("unknown auxiliary window label: {label}"))?;
    let registry = app_handle
        .state::<AuxiliaryWindowRegistry>()
        .inner()
        .clone();
    let reservation = registry.reserve(
        descriptor.label,
        app_handle.get_webview_window(descriptor.label).is_some(),
    );
    let generation = match reservation {
        EnsureReservation::Reuse(generation) => return Ok(generation),
        EnsureReservation::Wait(generation) => generation,
        EnsureReservation::Create(generation) => {
            if let Err(error) = build_auxiliary_window(app_handle, descriptor, generation) {
                registry.remove_generation(descriptor.label, generation);
                return Err(format!(
                    "failed to create auxiliary window {}: {error}",
                    descriptor.label
                ));
            }
            generation
        }
    };

    let waiter_registry = registry.clone();
    let wait_result = tauri::async_runtime::spawn_blocking(move || {
        waiter_registry.wait_until_ready(descriptor.label, generation, AUXILIARY_READY_TIMEOUT)
    })
    .await
    .map_err(|error| error.to_string())?;

    if let Err(error) = wait_result {
        registry.remove_generation(descriptor.label, generation);
        if let Some(window) = app_handle.get_webview_window(descriptor.label) {
            let _ = window.destroy();
        }
        return Err(error);
    }

    Ok(generation)
}

#[tauri::command]
pub async fn ensure_auxiliary_window(app_handle: AppHandle, label: String) -> Result<u64, String> {
    ensure_auxiliary_window_ready(&app_handle, &label).await
}

#[tauri::command]
pub fn mark_auxiliary_window_ready(
    window: WebviewWindow,
    registry: State<'_, AuxiliaryWindowRegistry>,
    generation: u64,
) -> Result<bool, String> {
    if auxiliary_window_descriptor(window.label()).is_none() {
        return Err(format!(
            "window {} is not a registered auxiliary window",
            window.label()
        ));
    }

    Ok(registry.mark_ready(window.label(), generation))
}
