use crate::{
    error::CommandResult,
    lyrics::{self, LyricLine},
    state::{with_db, AppState},
};
use tauri::State;

#[tauri::command]
pub fn get_lyrics(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Option<Vec<LyricLine>>> {
    with_db(&state, |conn| lyrics::find_for_song(conn, &song_id))
}
