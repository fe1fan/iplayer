use crate::{
    error::{AppError, CommandResult},
    model::library::{Playlist, ToggleLikeResponse},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub fn get_playlists(state: State<'_, AppState>) -> CommandResult<Vec<Playlist>> {
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    Ok(store.playlists.clone())
}

#[tauri::command]
pub fn toggle_like(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<ToggleLikeResponse> {
    let mut store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    if !store.songs.iter().any(|song| song.id == song_id) {
        return Err(AppError::not_found("song not found"));
    }

    let liked = if store.liked_ids.contains(&song_id) {
        store.liked_ids.remove(&song_id);
        false
    } else {
        store.liked_ids.insert(song_id);
        true
    };

    Ok(ToggleLikeResponse {
        success: true,
        liked,
    })
}
