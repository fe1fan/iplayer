mod commands;
mod error;
mod model;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::library::get_library,
            commands::library::scan_library,
            commands::library::search_songs,
            commands::metadata::get_song_metadata,
            commands::metadata::update_metadata,
            commands::lyrics::get_lyrics,
            commands::playlist::get_playlists,
            commands::playlist::toggle_like,
        ])
        .setup(|app| {
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
