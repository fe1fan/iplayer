use crate::error::CommandResult;
use rusqlite::Connection;

pub fn run(conn: &Connection) -> CommandResult<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          file_path TEXT UNIQUE,
          folder_id TEXT,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT NOT NULL,
          album_id TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 0,
          format TEXT NOT NULL DEFAULT '',
          cover_class TEXT NOT NULL DEFAULT 'cover-a',
          year INTEGER NOT NULL DEFAULT 0,
          track TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS albums (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          year INTEGER NOT NULL DEFAULT 0,
          song_count INTEGER NOT NULL DEFAULT 0,
          cover_class TEXT NOT NULL DEFAULT 'cover-a',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS artists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          song_count INTEGER NOT NULL DEFAULT 0,
          album_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'list-music',
          system INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
          playlist_id TEXT NOT NULL,
          song_id TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (playlist_id, song_id),
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS liked_songs (
          song_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS recent_plays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          song_id TEXT NOT NULL,
          played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plugins (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          source TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          trust TEXT NOT NULL DEFAULT 'local',
          description TEXT NOT NULL DEFAULT '',
          config_type TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plugin_settings (
          plugin_id TEXT PRIMARY KEY,
          settings_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plugin_hooks (
          plugin_id TEXT NOT NULL,
          hook_id TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (plugin_id, hook_id),
          FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_songs_search ON songs(title, artist, album);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_file_path ON songs(file_path) WHERE file_path IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_songs_folder ON songs(folder_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id, position);
        CREATE INDEX IF NOT EXISTS idx_recent_plays_song ON recent_plays(song_id, played_at);
        ",
    )?;

    ensure_column(conn, "songs", "file_path", "TEXT")?;
    ensure_column(conn, "songs", "folder_id", "TEXT")?;
    ensure_column(conn, "songs", "cover_url", "TEXT")?;

    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> CommandResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column {
            return Ok(());
        }
    }

    conn.execute_batch(&format!(
        "ALTER TABLE {table} ADD COLUMN {column} {definition};"
    ))?;
    Ok(())
}
