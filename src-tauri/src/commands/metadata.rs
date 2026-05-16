use crate::{
    error::{AppError, CommandResult},
    model::library::{MetadataPatch, Song, UpdateMetadataResponse},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub fn get_song_metadata(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Option<Song>> {
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    Ok(store.songs.iter().find(|song| song.id == song_id).cloned())
}

#[tauri::command]
pub fn update_metadata(
    song_id: String,
    data: MetadataPatch,
    state: State<'_, AppState>,
) -> CommandResult<UpdateMetadataResponse> {
    let mut store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;
    let song = store
        .songs
        .iter_mut()
        .find(|song| song.id == song_id)
        .ok_or_else(|| AppError::not_found("song not found"))?;

    if let Some(title) = data.title {
        song.title = title;
    }
    if let Some(artist) = data.artist {
        song.artist = artist;
    }
    if let Some(album) = data.album {
        song.album = album;
    }
    if let Some(year) = data.year {
        song.year = year;
    }
    if let Some(track) = data.track {
        song.track = track;
    }

    Ok(UpdateMetadataResponse {
        success: true,
        song: song.clone(),
    })
}
