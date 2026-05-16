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
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    Ok(store.lyrics.get(&song_id).cloned())
}
