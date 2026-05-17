use crate::{
    error::{AppError, CommandResult},
    model::plugin::Plugin,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub fn seed_default_plugins(conn: &Connection) -> CommandResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM plugins", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    for plugin in default_plugins() {
        upsert_plugin(conn, &plugin)?;
    }
    Ok(())
}

pub fn list_plugins(conn: &Connection) -> CommandResult<Vec<Plugin>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, name, version, source, enabled, trust, description, config_type, created_at
        FROM plugins
        ORDER BY created_at, name COLLATE NOCASE
        ",
    )?;
    let plugin_rows = stmt
        .query_map([], |row| {
            Ok(PluginRow {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                source: row.get(3)?,
                enabled: row.get::<_, i64>(4)? != 0,
                trust: row.get(5)?,
                description: row.get(6)?,
                config_type: row.get::<_, Option<String>>(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut out = Vec::with_capacity(plugin_rows.len());
    for row in plugin_rows {
        let hooks = list_hooks_for_plugin(conn, &row.id)?;
        let settings = get_settings(conn, &row.id)?;
        out.push(Plugin {
            id: row.id,
            name: row.name,
            version: row.version,
            source: row.source,
            enabled: row.enabled,
            trust: row.trust,
            hooks,
            description: row.description,
            config_type: row.config_type,
            settings,
        });
    }
    Ok(out)
}

pub fn get_plugin(conn: &Connection, plugin_id: &str) -> CommandResult<Plugin> {
    let row = conn
        .query_row(
            "SELECT id, name, version, source, enabled, trust, description, config_type
             FROM plugins WHERE id = ?1",
            params![plugin_id],
            |row| {
                Ok(PluginRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    version: row.get(2)?,
                    source: row.get(3)?,
                    enabled: row.get::<_, i64>(4)? != 0,
                    trust: row.get(5)?,
                    description: row.get(6)?,
                    config_type: row.get::<_, Option<String>>(7)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::not_found(format!("plugin {} not found", plugin_id)))?;

    let hooks = list_hooks_for_plugin(conn, &row.id)?;
    let settings = get_settings(conn, &row.id)?;
    Ok(Plugin {
        id: row.id,
        name: row.name,
        version: row.version,
        source: row.source,
        enabled: row.enabled,
        trust: row.trust,
        hooks,
        description: row.description,
        config_type: row.config_type,
        settings,
    })
}

pub fn upsert_plugin(conn: &Connection, plugin: &Plugin) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO plugins (id, name, version, source, enabled, trust, description, config_type)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          version = excluded.version,
          source = excluded.source,
          enabled = excluded.enabled,
          trust = excluded.trust,
          description = excluded.description,
          config_type = excluded.config_type,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            plugin.id,
            plugin.name,
            plugin.version,
            plugin.source,
            plugin.enabled as i64,
            plugin.trust,
            plugin.description,
            plugin.config_type,
        ],
    )?;
    set_hooks_for_plugin(conn, &plugin.id, &plugin.hooks)?;
    if !plugin.settings.is_null() {
        save_settings(conn, &plugin.id, &plugin.settings)?;
    }
    Ok(())
}

pub fn set_plugin_enabled(conn: &Connection, plugin_id: &str, enabled: bool) -> CommandResult<()> {
    let changed = conn.execute(
        "UPDATE plugins SET enabled = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![enabled as i64, plugin_id],
    )?;
    if changed == 0 {
        return Err(AppError::not_found(format!("plugin {} not found", plugin_id)));
    }
    Ok(())
}

pub fn save_settings(conn: &Connection, plugin_id: &str, settings: &Value) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO plugin_settings (plugin_id, settings_json)
        VALUES (?1, ?2)
        ON CONFLICT(plugin_id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![plugin_id, settings.to_string()],
    )?;
    Ok(())
}

pub fn get_settings(conn: &Connection, plugin_id: &str) -> CommandResult<Value> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT settings_json FROM plugin_settings WHERE plugin_id = ?1",
            params![plugin_id],
            |row| row.get(0),
        )
        .optional()?;
    match raw {
        Some(text) => Ok(serde_json::from_str(&text).unwrap_or_else(|_| json!({}))),
        None => Ok(json!({})),
    }
}

pub fn enabled_plugins_for_hook(conn: &Connection, hook_id: &str) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT p.id FROM plugins p
        INNER JOIN plugin_hooks h ON h.plugin_id = p.id
        WHERE p.enabled = 1 AND h.hook_id = ?1 AND h.enabled = 1
        ORDER BY p.created_at
        ",
    )?;
    let rows = stmt.query_map(params![hook_id], |row| row.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn list_hooks_for_plugin(conn: &Connection, plugin_id: &str) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT hook_id FROM plugin_hooks WHERE plugin_id = ?1 AND enabled = 1 ORDER BY hook_id",
    )?;
    let rows = stmt.query_map(params![plugin_id], |row| row.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn set_hooks_for_plugin(conn: &Connection, plugin_id: &str, hooks: &[String]) -> CommandResult<()> {
    conn.execute(
        "DELETE FROM plugin_hooks WHERE plugin_id = ?1",
        params![plugin_id],
    )?;
    for hook in hooks {
        conn.execute(
            "INSERT OR IGNORE INTO plugin_hooks (plugin_id, hook_id, enabled) VALUES (?1, ?2, 1)",
            params![plugin_id, hook],
        )?;
    }
    Ok(())
}

struct PluginRow {
    id: String,
    name: String,
    version: String,
    source: String,
    enabled: bool,
    trust: String,
    description: String,
    config_type: Option<String>,
}

fn default_plugins() -> Vec<Plugin> {
    vec![
        Plugin {
            id: "plug-library-import".into(),
            name: "Universal Library Loader".into(),
            version: "0.3.0".into(),
            source: "local://plugins/library-loader".into(),
            enabled: true,
            trust: "local".into(),
            hooks: vec![
                "library:source-resolve".into(),
                "library:before-scan".into(),
                "library:file-discovered".into(),
                "library:metadata-read".into(),
                "library:after-load".into(),
                "playlist:generate".into(),
            ],
            description: "从本地目录、挂载盘或远程清单汇入音乐库。".into(),
            config_type: Some("library".into()),
            settings: json!({
                "roots": "~/Music, /Volumes/Music",
                "duplicateStrategy": "prefer-lossless",
                "autoPlaylist": true
            }),
        },
        Plugin {
            id: "plug-audio-curve".into(),
            name: "Warm Output Curve".into(),
            version: "1.1.2".into(),
            source: "npm:@iplayer/warm-output".into(),
            enabled: true,
            trust: "sandboxed".into(),
            hooks: vec![
                "playback:before-play".into(),
                "decode:after".into(),
                "audio:process-output".into(),
                "audio:before-device".into(),
            ],
            description: "在播放前套用响度归一、柔和 EQ 与输出质量预设。".into(),
            config_type: Some("audio".into()),
            settings: json!({
                "preset": "warm",
                "bass": 2,
                "treble": -1,
                "loudness": true
            }),
        },
        Plugin {
            id: "plug-lyrics-meta".into(),
            name: "Open Metadata Bridge".into(),
            version: "0.8.4".into(),
            source: "https://plugins.example.com/open-metadata.json".into(),
            enabled: false,
            trust: "remote".into(),
            hooks: vec![
                "metadata:resolve".into(),
                "artwork:resolve".into(),
                "lyrics:resolve".into(),
                "telemetry:scrobble".into(),
            ],
            description: "模拟接入第三方元数据与歌词提供方。".into(),
            config_type: Some("metadata".into()),
            settings: json!({
                "provider": "open-metadata",
                "apiKey": "",
                "translateLyrics": false
            }),
        },
    ]
}
