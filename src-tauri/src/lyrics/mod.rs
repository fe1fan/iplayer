use crate::{
    db::repository,
    error::CommandResult,
};
use rusqlite::Connection;
use std::{fs, path::PathBuf};

pub mod lrc;

pub use lrc::LyricLine;

pub fn find_for_song(conn: &Connection, song_id: &str) -> CommandResult<Option<Vec<LyricLine>>> {
    let Some(song) = repository::get_song(conn, song_id)? else {
        return Ok(None);
    };
    let Some(path) = song.file_path else {
        return Ok(None);
    };
    let audio = PathBuf::from(path);
    let lrc = audio.with_extension("lrc");
    if !lrc.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&lrc)?;
    let lines = lrc::parse(&content);
    if lines.is_empty() {
        Ok(None)
    } else {
        Ok(Some(lines))
    }
}
