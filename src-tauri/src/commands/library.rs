use crate::{
    db::repository,
    error::{AppError, CommandResult},
    library::scanner,
    model::library::{LibrarySnapshot, ScanSummary, Song},
    state::{with_db, AppState},
};
use std::path::Path;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

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
    if let Some(path) = path.as_deref().filter(|value| !value.trim().is_empty()) {
        return import_scan(path, &state);
    }

    with_db(&state, |conn| {
        let songs = repository::list_songs(conn)?;
        let albums = repository::list_albums(conn)?;
        Ok(ScanSummary {
            total: songs.len(),
            songs,
            albums,
            scanned_path: path,
            imported: 0,
            skipped: 0,
        })
    })
}

#[tauri::command]
pub fn search_songs(query: String, state: State<'_, AppState>) -> CommandResult<Vec<Song>> {
    with_db(&state, |conn| repository::search_songs(conn, &query))
}

#[tauri::command]
pub async fn pick_and_scan_library(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<Option<ScanSummary>> {
    let Some(folder) = app
        .dialog()
        .file()
        .set_title("选择音乐文件夹")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let path = folder
        .into_path()
        .map_err(|error| AppError::state(error.to_string()))?;
    import_scan(path, &state).map(Some)
}

fn import_scan(path: impl AsRef<Path>, state: &AppState) -> CommandResult<ScanSummary> {
    let scan = scanner::scan_path(path)?;
    with_db(state, |conn| {
        repository::import_scanned_songs(conn, &scan.root_path, &scan.songs)?;
        let songs = repository::list_songs(conn)?;
        let albums = repository::list_albums(conn)?;
        Ok(ScanSummary {
            total: songs.len(),
            songs,
            albums,
            scanned_path: Some(scan.root_path),
            imported: scan.songs.len(),
            skipped: scan.skipped,
        })
    })
}
