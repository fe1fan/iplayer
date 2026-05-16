use crate::{
    db::repository,
    error::CommandResult,
    model::library::{
        AddSongsToPlaylistResponse, CreatePlaylistResponse, DeletePlaylistResponse, Playlist,
        RemoveSongFromPlaylistResponse, RenamePlaylistResponse, ToggleLikeResponse,
    },
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
pub fn rename_playlist(
    playlist_id: String,
    name: String,
    state: State<'_, AppState>,
) -> CommandResult<RenamePlaylistResponse> {
    with_db(&state, |conn| {
        let playlist = repository::rename_playlist(conn, &playlist_id, &name)?;
        Ok(RenamePlaylistResponse {
            success: true,
            playlist,
        })
    })
}

#[tauri::command]
pub fn delete_playlist(
    playlist_id: String,
    state: State<'_, AppState>,
) -> CommandResult<DeletePlaylistResponse> {
    with_db(&state, |conn| {
        repository::delete_playlist(conn, &playlist_id)?;
        Ok(DeletePlaylistResponse { success: true })
    })
}

#[tauri::command]
pub fn add_songs_to_playlist(
    playlist_id: String,
    song_ids: Vec<String>,
    state: State<'_, AppState>,
) -> CommandResult<AddSongsToPlaylistResponse> {
    with_db(&state, |conn| {
        let playlist = repository::add_songs_to_playlist(conn, &playlist_id, &song_ids)?;
        Ok(AddSongsToPlaylistResponse {
            success: true,
            playlist,
        })
    })
}

#[tauri::command]
pub fn remove_song_from_playlist(
    playlist_id: String,
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<RemoveSongFromPlaylistResponse> {
    with_db(&state, |conn| {
        let playlist = repository::remove_song_from_playlist(conn, &playlist_id, &song_id)?;
        Ok(RemoveSongFromPlaylistResponse {
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
