use crate::{
    db::repository,
    error::CommandResult,
    model::library::{LibrarySnapshot, ScanSummary, Song},
    state::{with_db, AppState},
};
use tauri::State;

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> CommandResult<LibrarySnapshot> {
    with_db(&state, |conn| {
        let songs = repository::list_songs(conn)?;
        let albums = repository::list_albums(conn)?;
        Ok(LibrarySnapshot {
            total: songs.len(),
            songs,
            albums,
        })
    })
}

#[tauri::command]
pub fn scan_library(
    path: Option<String>,
    state: State<'_, AppState>,
) -> CommandResult<ScanSummary> {
    with_db(&state, |conn| {
        let songs = repository::list_songs(conn)?;
        let albums = repository::list_albums(conn)?;
        Ok(ScanSummary {
            total: songs.len(),
            songs,
            albums,
            scanned_path: path,
        })
    })
}

#[tauri::command]
pub fn search_songs(query: String, state: State<'_, AppState>) -> CommandResult<Vec<Song>> {
    with_db(&state, |conn| repository::search_songs(conn, &query))
}
