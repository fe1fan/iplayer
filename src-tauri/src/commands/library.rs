use crate::{
    error::{AppError, CommandResult},
    model::library::{LibrarySnapshot, ScanSummary, Song},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> CommandResult<LibrarySnapshot> {
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    Ok(LibrarySnapshot {
        songs: store.songs.clone(),
        albums: store.albums.clone(),
        total: store.songs.len(),
    })
}

#[tauri::command]
pub fn scan_library(
    path: Option<String>,
    state: State<'_, AppState>,
) -> CommandResult<ScanSummary> {
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    Ok(ScanSummary {
        songs: store.songs.clone(),
        albums: store.albums.clone(),
        total: store.songs.len(),
        scanned_path: path,
    })
}

#[tauri::command]
pub fn search_songs(query: String, state: State<'_, AppState>) -> CommandResult<Vec<Song>> {
    let store = state
        .library
        .lock()
        .map_err(|_| AppError::state("library state is unavailable"))?;

    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Ok(store.songs.clone());
    }

    Ok(store
        .songs
        .iter()
        .filter(|song| {
            song.title.to_lowercase().contains(&query)
                || song.artist.to_lowercase().contains(&query)
                || song.album.to_lowercase().contains(&query)
        })
        .cloned()
        .collect())
}
