use crate::{
    db::repository::albums,
    error::{AppError, CommandResult},
    model::library::{MetadataPatch, Song},
};
use rusqlite::{params, Connection, OptionalExtension};

pub fn list_songs(conn: &Connection) -> CommandResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map([], map_song)?;
    collect_songs(rows)
}

pub fn search_songs(conn: &Connection, query: &str) -> CommandResult<Vec<Song>> {
    let query = query.trim();
    if query.is_empty() {
        return list_songs(conn);
    }

    let pattern = format!("%{}%", query.to_lowercase());
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        WHERE lower(title) LIKE ?1 OR lower(artist) LIKE ?1 OR lower(album) LIKE ?1
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map(params![pattern], map_song)?;
    collect_songs(rows)
}

pub fn get_song(conn: &Connection, song_id: &str) -> CommandResult<Option<Song>> {
    conn.query_row(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        WHERE id = ?1
        ",
        params![song_id],
        map_song,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn update_song_metadata(
    conn: &Connection,
    song_id: &str,
    patch: MetadataPatch,
) -> CommandResult<Song> {
    let mut song = get_song(conn, song_id)?.ok_or_else(|| AppError::not_found("song not found"))?;

    if let Some(title) = patch.title {
        song.title = title;
    }
    if let Some(artist) = patch.artist {
        song.artist = artist;
    }
    if let Some(album) = patch.album {
        song.album = album;
    }
    if let Some(year) = patch.year {
        song.year = year;
    }
    if let Some(track) = patch.track {
        song.track = track;
    }
    if let Some(cover_url) = patch.cover_url {
        song.cover_url = Some(cover_url);
    }

    conn.execute(
        "
        UPDATE songs
        SET title = ?2, artist = ?3, album = ?4, year = ?5, track = ?6, cover_url = ?7, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![song.id, song.title, song.artist, song.album, song.year, song.track, song.cover_url],
    )?;

    albums::rebuild_library_facets(conn)?;
    Ok(song)
}

pub(crate) fn upsert_song(conn: &Connection, song: &Song) -> CommandResult<()> {
    if let Some(file_path) = song.file_path.as_deref() {
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM songs WHERE file_path = ?1",
                params![file_path],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(existing_id) = existing_id {
            update_song_row(conn, &existing_id, song)?;
            return Ok(());
        }
    }

    conn.execute(
        "
        INSERT INTO songs (id, file_path, folder_id, title, artist, album, album_id, duration, format, cover_class, year, track, cover_url)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(id) DO UPDATE SET
          file_path = excluded.file_path,
          title = excluded.title,
          artist = excluded.artist,
          album = excluded.album,
          album_id = excluded.album_id,
          duration = excluded.duration,
          format = excluded.format,
          cover_class = excluded.cover_class,
          year = excluded.year,
          track = excluded.track,
          folder_id = excluded.folder_id,
          cover_url = excluded.cover_url,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            song.id,
            song.file_path,
            song.folder_id,
            song.title,
            song.artist,
            song.album,
            song.album_id,
            song.duration as i64,
            song.format,
            song.cover_class,
            song.year,
            song.track,
            song.cover_url
        ],
    )?;
    Ok(())
}

fn update_song_row(conn: &Connection, song_id: &str, song: &Song) -> CommandResult<()> {
    conn.execute(
        "
        UPDATE songs
        SET
          file_path = ?2,
          folder_id = ?3,
          title = ?4,
          artist = ?5,
          album = ?6,
          album_id = ?7,
          duration = ?8,
          format = ?9,
          cover_class = ?10,
          year = ?11,
          track = ?12,
          cover_url = ?13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![
            song_id,
            song.file_path,
            song.folder_id,
            song.title,
            song.artist,
            song.album,
            song.album_id,
            song.duration as i64,
            song.format,
            song.cover_class,
            song.year,
            song.track,
            song.cover_url
        ],
    )?;
    Ok(())
}

fn collect_songs(
    rows: impl Iterator<Item = Result<Song, rusqlite::Error>>,
) -> CommandResult<Vec<Song>> {
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn map_song(row: &rusqlite::Row<'_>) -> rusqlite::Result<Song> {
    Ok(Song {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        album_id: row.get(4)?,
        duration: row.get::<_, i64>(5)? as u64,
        format: row.get(6)?,
        cover_class: row.get(7)?,
        year: row.get(8)?,
        track: row.get(9)?,
        file_path: row.get(10)?,
        folder_id: row.get(11)?,
        cover_url: row.get(12)?,
    })
}
