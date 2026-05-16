use crate::{
    db::repository,
    error::CommandResult,
    model::library::{MetadataPatch, Song, UpdateMetadataResponse},
    state::{with_db, AppState},
};
use tauri::State;

#[tauri::command]
pub fn get_song_metadata(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Option<Song>> {
    with_db(&state, |conn| repository::get_song(conn, &song_id))
}

#[tauri::command]
pub fn update_metadata(
    song_id: String,
    data: MetadataPatch,
    state: State<'_, AppState>,
) -> CommandResult<UpdateMetadataResponse> {
    with_db(&state, |conn| {
        let song = repository::update_song_metadata(conn, &song_id, data)?;
        Ok(UpdateMetadataResponse {
            success: true,
            song,
        })
    })
}
