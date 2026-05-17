use crate::{db::plugin_repo, state::AppState};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn dispatch<R: Runtime>(app: &AppHandle<R>, hook_id: &str, payload: Value) {
    let Some(state) = app.try_state::<AppState>() else {
        log::debug!("hook {hook_id} skipped: no state");
        return;
    };
    let plugins = {
        let Ok(conn) = state.db.lock() else {
            log::warn!("hook {hook_id}: db lock failed");
            return;
        };
        match plugin_repo::enabled_plugins_for_hook(&conn, hook_id) {
            Ok(list) => list,
            Err(error) => {
                log::warn!("hook {hook_id} lookup failed: {error}");
                return;
            }
        }
    };
    log::info!(
        "plugin hook dispatched: {hook_id} → plugins={:?}",
        plugins
    );
    let event = json!({
        "hookId": hook_id,
        "plugins": plugins,
        "payload": payload,
    });
    if let Err(error) = app.emit("plugin:hook", event) {
        log::debug!("failed to emit plugin:hook event: {error}");
    }
}
