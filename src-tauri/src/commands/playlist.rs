use crate::{
    db::repository,
    error::CommandResult,
    model::library::{CreatePlaylistResponse, Playlist, ToggleLikeResponse},
    state::{with_db, AppState},
};
use tauri::State;

#[tauri::command]
pub fn get_playlists(state: State<'_, AppState>) -> CommandResult<Vec<Playlist>> {
    with_db(&state, repository::list_playlists)
}

#[tauri::command]
pub fn create_playlist(
    name: Option<String>,
    state: State<'_, AppState>,
) -> CommandResult<CreatePlaylistResponse> {
    with_db(&state, |conn| {
        let playlist = repository::create_playlist(conn, name)?;
        Ok(CreatePlaylistResponse {
            success: true,
            playlist,
        })
    })
}

#[tauri::command]
pub fn toggle_like(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<ToggleLikeResponse> {
    with_db(&state, |conn| {
        let liked = repository::toggle_like(conn, &song_id)?;
        Ok(ToggleLikeResponse {
            success: true,
            liked,
        })
    })
}
