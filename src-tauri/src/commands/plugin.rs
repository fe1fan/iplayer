use crate::{
    db::plugin_repo,
    error::CommandResult,
    model::plugin::{Plugin, PluginSourceInput},
    state::{with_db, AppState},
};
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub fn get_plugins(state: State<'_, AppState>) -> CommandResult<Vec<Plugin>> {
    with_db(&state, |conn| plugin_repo::list_plugins(conn))
}

#[tauri::command]
pub fn load_plugin_source(
    source: PluginSourceInput,
    state: State<'_, AppState>,
) -> CommandResult<Plugin> {
    let plugin = build_plugin_from_source(&source);
    with_db(&state, |conn| plugin_repo::upsert_plugin(conn, &plugin))?;
    with_db(&state, |conn| plugin_repo::get_plugin(conn, &plugin.id))
}

#[tauri::command]
pub fn set_plugin_enabled(
    plugin_id: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> CommandResult<Plugin> {
    with_db(&state, |conn| {
        plugin_repo::set_plugin_enabled(conn, &plugin_id, enabled)
    })?;
    with_db(&state, |conn| plugin_repo::get_plugin(conn, &plugin_id))
}

#[tauri::command]
pub fn save_plugin_settings(
    plugin_id: String,
    settings: Value,
    state: State<'_, AppState>,
) -> CommandResult<Plugin> {
    with_db(&state, |conn| {
        plugin_repo::save_settings(conn, &plugin_id, &settings)
    })?;
    with_db(&state, |conn| plugin_repo::get_plugin(conn, &plugin_id))
}

fn build_plugin_from_source(source: &PluginSourceInput) -> Plugin {
    let kind = source.kind.as_str();
    let value = source.value.trim();
    let id = format!("plug-{}", chrono::Utc::now().timestamp_millis());
    let trust = match kind {
        "local" => "local",
        "url" => "remote",
        "git" => "remote",
        "npm" => "sandboxed",
        _ => "sandboxed",
    };
    let name = source.name.clone().unwrap_or_else(|| infer_name(value));
    Plugin {
        id,
        name,
        version: "0.1.0".into(),
        source: format!("{kind}:{value}"),
        enabled: true,
        trust: trust.into(),
        hooks: vec![
            "app:init".into(),
            "library:source-resolve".into(),
            "playback:before-play".into(),
            "ui:plugin-view".into(),
        ],
        description: "通过插件管理页加载的来源，运行时按声明的节点接入。".into(),
        config_type: Some("generic".into()),
        settings: json!({ "sandbox": "strict", "timeout": 10 }),
    }
}

fn infer_name(value: &str) -> String {
    let clean = value.trim_end_matches('/');
    let last = clean
        .rsplit(|c: char| c == '/' || c == ':')
        .find(|segment| !segment.is_empty())
        .unwrap_or("Custom Plugin");
    let cleaned = last.trim_start_matches('@').replace(['-', '_'], " ");
    let mut out = String::with_capacity(cleaned.len());
    let mut new_word = true;
    for ch in cleaned.chars() {
        if ch.is_whitespace() {
            new_word = true;
            out.push(ch);
        } else if new_word {
            for upper in ch.to_uppercase() {
                out.push(upper);
            }
            new_word = false;
        } else {
            out.push(ch);
        }
    }
    out
}
