use crate::{
    error::{AppError, CommandResult},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub fn get_lyrics(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Option<Vec<String>>> {
    let lyrics = state
        .lyrics
        .lock()
        .map_err(|_| AppError::state("lyrics state is unavailable"))?;

    Ok(lyrics.get(&song_id).cloned())
}
