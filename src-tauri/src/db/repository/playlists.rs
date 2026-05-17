use crate::{
    db::repository::songs,
    error::{AppError, CommandResult},
    model::library::Playlist,
};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn list_playlists(conn: &Connection) -> CommandResult<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, name, icon, system
        FROM playlists
        ORDER BY system DESC, position ASC, created_at ASC
        ",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)? != 0,
        ))
    })?;

    let mut playlists = Vec::new();
    for row in rows {
        let (id, name, icon, system) = row?;
        let song_ids = song_ids_for(conn, &id)?;
        playlists.push(Playlist {
            song_ids,
            id,
            name,
            icon,
            system,
        });
    }
    Ok(playlists)
}

pub fn create_playlist(conn: &Connection, name: Option<String>) -> CommandResult<Playlist> {
    let index: i64 = conn.query_row(
        "SELECT COUNT(*) + 1 FROM playlists WHERE system = 0",
        [],
        |row| row.get(0),
    )?;
    let playlist = Playlist {
        id: format!("pl-{}", Uuid::new_v4()),
        name: name.unwrap_or_else(|| format!("新播放列表 {}", index)),
        icon: "list-music".into(),
        system: false,
        song_ids: Vec::new(),
    };
    upsert_playlist(conn, &playlist, index + 100)?;
    Ok(playlist)
}

pub fn add_songs_to_playlist(
    conn: &Connection,
    playlist_id: &str,
    song_ids: &[String],
) -> CommandResult<Playlist> {
    let playlist =
        get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state(
            "system playlists cannot be modified directly",
        ));
    }

    let mut position: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    )?;
    for song_id in song_ids {
        if songs::get_song(conn, song_id)?.is_none() {
            continue;
        }
        conn.execute(
            "
            INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position)
            VALUES (?1, ?2, ?3)
            ",
            params![playlist_id, song_id, position],
        )?;
        position += 1;
    }

    get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))
}

pub fn rename_playlist(
    conn: &Connection,
    playlist_id: &str,
    name: &str,
) -> CommandResult<Playlist> {
    let mut playlist =
        get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state("system playlists cannot be renamed"));
    }
    conn.execute(
        "UPDATE playlists SET name = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![playlist_id, name],
    )?;
    playlist.name = name.to_string();
    Ok(playlist)
}

pub fn delete_playlist(conn: &Connection, playlist_id: &str) -> CommandResult<bool> {
    let playlist = get_playlist(conn, playlist_id)?;
    let Some(playlist) = playlist else {
        return Ok(false);
    };
    if playlist.system {
        return Err(AppError::state("system playlists cannot be deleted"));
    }
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])?;
    Ok(true)
}

pub fn remove_song_from_playlist(
    conn: &Connection,
    playlist_id: &str,
    song_id: &str,
) -> CommandResult<Playlist> {
    let playlist =
        get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state(
            "songs cannot be removed from system playlists directly",
        ));
    }
    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        params![playlist_id, song_id],
    )?;
    get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))
}

pub(crate) fn upsert_playlist(
    conn: &Connection,
    playlist: &Playlist,
    position: i64,
) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO playlists (id, name, icon, system, position)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          system = excluded.system,
          position = excluded.position,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            playlist.id,
            playlist.name,
            playlist.icon,
            if playlist.system { 1 } else { 0 },
            position
        ],
    )?;

    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1",
        params![playlist.id],
    )?;
    for (position, song_id) in playlist.song_ids.iter().enumerate() {
        conn.execute(
            "
            INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position)
            VALUES (?1, ?2, ?3)
            ",
            params![playlist.id, song_id, position as i64],
        )?;
    }

    Ok(())
}

fn get_playlist(conn: &Connection, playlist_id: &str) -> CommandResult<Option<Playlist>> {
    let row = conn
        .query_row(
            "
            SELECT id, name, icon, system
            FROM playlists
            WHERE id = ?1
            ",
            params![playlist_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)? != 0,
                ))
            },
        )
        .optional()?;

    let Some((id, name, icon, system)) = row else {
        return Ok(None);
    };
    let song_ids = song_ids_for(conn, &id)?;
    Ok(Some(Playlist {
        id,
        name,
        icon,
        system,
        song_ids,
    }))
}

fn song_ids_for(conn: &Connection, playlist_id: &str) -> CommandResult<Vec<String>> {
    if playlist_id == "liked" {
        return liked_song_ids(conn);
    }
    if playlist_id == "recent" {
        return recent_song_ids(conn);
    }
    playlist_song_ids(conn, playlist_id)
}

fn playlist_song_ids(conn: &Connection, playlist_id: &str) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM playlist_songs
        WHERE playlist_id = ?1
        ORDER BY position ASC, created_at ASC
        ",
    )?;
    let rows = stmt.query_map(params![playlist_id], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn liked_song_ids(conn: &Connection) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM liked_songs
        ORDER BY created_at DESC
        ",
    )?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn recent_song_ids(conn: &Connection) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM recent_plays
        GROUP BY song_id
        ORDER BY MAX(played_at) DESC
        LIMIT 100
        ",
    )?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
