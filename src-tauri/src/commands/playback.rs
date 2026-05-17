use crate::{
    db::repository,
    error::CommandResult,
    playback::engine::PlaybackStateSnapshot,
    plugin::{self, HookId},
    state::AppState,
};
use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn play_song(
    song_id: String,
    queue: Vec<String>,
    queue_index: Option<usize>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<PlaybackStateSnapshot> {
    let conn = state.db.lock().unwrap();
    let song = repository::get_song(&conn, &song_id)?
        .ok_or_else(|| crate::error::AppError::not_found("song not found"))?;
    drop(conn);

    plugin::dispatch(
        &app,
        HookId::PLAYBACK_BEFORE_PLAY,
        json!({ "songId": song_id, "title": song.title, "artist": song.artist }),
    );

    let queue_index =
        queue_index.unwrap_or(queue.iter().position(|id| id == &song_id).unwrap_or(0));
    state.playback.play_song(song, queue, queue_index)?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn pause(state: State<'_, AppState>) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.pause()?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn resume(state: State<'_, AppState>) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.resume()?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn stop(app: AppHandle, state: State<'_, AppState>) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.stop()?;
    plugin::dispatch(&app, HookId::PLAYBACK_AFTER_STOP, json!({}));
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn seek(
    position_secs: u64,
    state: State<'_, AppState>,
) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.seek(Duration::from_secs(position_secs))?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn set_volume(
    volume: f32,
    state: State<'_, AppState>,
) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.set_volume(volume)?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn skip_track(
    delta: i32,
    state: State<'_, AppState>,
) -> CommandResult<PlaybackStateSnapshot> {
    let conn = state.db.lock().unwrap();
    state.playback.skip_track(delta, &conn)?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn set_loop_mode(
    mode: String,
    state: State<'_, AppState>,
) -> CommandResult<PlaybackStateSnapshot> {
    state.playback.set_loop_mode(&mode)?;
    Ok(state.playback.get_state())
}

#[tauri::command]
pub fn get_playback_state(state: State<'_, AppState>) -> CommandResult<PlaybackStateSnapshot> {
    Ok(state.playback.get_state())
}
