mod commands;
mod db;
mod error;
mod library;
mod model;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::library::get_library,
            commands::library::pick_and_scan_library,
            commands::library::scan_library,
            commands::library::search_songs,
            commands::metadata::get_song_metadata,
            commands::metadata::update_metadata,
            commands::lyrics::get_lyrics,
            commands::playlist::add_songs_to_playlist,
            commands::playlist::create_playlist,
            commands::playlist::get_playlists,
            commands::playlist::toggle_like,
        ])
        .setup(|app| {
            let state = AppState::initialize(app.handle())?;
            app.manage(state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
