use crate::{
    db::repository::songs,
    error::{AppError, CommandResult},
};
use rusqlite::{params, Connection};

pub fn toggle_like(conn: &Connection, song_id: &str) -> CommandResult<bool> {
    if songs::get_song(conn, song_id)?.is_none() {
        return Err(AppError::not_found("song not found"));
    }

    let liked = is_liked(conn, song_id)?;
    set_liked(conn, song_id, !liked)?;
    Ok(!liked)
}

pub fn is_liked(conn: &Connection, song_id: &str) -> CommandResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM liked_songs WHERE song_id = ?1",
        params![song_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn set_liked(conn: &Connection, song_id: &str, liked: bool) -> CommandResult<()> {
    if liked {
        conn.execute(
            "INSERT OR IGNORE INTO liked_songs (song_id) VALUES (?1)",
            params![song_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM liked_songs WHERE song_id = ?1",
            params![song_id],
        )?;
    }
    Ok(())
}
