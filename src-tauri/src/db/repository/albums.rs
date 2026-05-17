use crate::{
    error::{AppError, CommandResult},
    model::library::Album,
};
use rusqlite::{params, Connection};

pub fn list_albums(conn: &Connection) -> CommandResult<Vec<Album>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, year, song_count, cover_class
        FROM albums
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Album {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            year: row.get(3)?,
            song_count: row.get::<_, i64>(4)? as usize,
            cover_class: row.get(5)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub(crate) fn upsert_album(conn: &Connection, album: &Album) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO albums (id, title, artist, year, song_count, cover_class)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          artist = excluded.artist,
          year = excluded.year,
          song_count = excluded.song_count,
          cover_class = excluded.cover_class,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            album.id,
            album.title,
            album.artist,
            album.year,
            album.song_count as i64,
            album.cover_class
        ],
    )?;
    Ok(())
}

pub(crate) fn rebuild_library_facets(conn: &Connection) -> CommandResult<()> {
    conn.execute("DELETE FROM albums", [])?;
    conn.execute(
        "
        INSERT INTO albums (id, title, artist, year, song_count, cover_class)
        SELECT
          album_id,
          album,
          MIN(artist),
          COALESCE(NULLIF(MIN(year), 0), 0),
          COUNT(*),
          MIN(cover_class)
        FROM songs
        GROUP BY album_id, album
        ",
        [],
    )?;

    conn.execute("DELETE FROM artists", [])?;
    conn.execute(
        "
        INSERT INTO artists (id, name, song_count, album_count)
        SELECT
          'artist-' || lower(hex(name)),
          name,
          COUNT(*),
          COUNT(DISTINCT album_id)
        FROM (
          SELECT artist AS name, album_id
          FROM songs
        )
        GROUP BY name
        ",
        [],
    )?;

    Ok(())
}
