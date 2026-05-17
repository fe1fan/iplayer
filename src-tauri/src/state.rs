use crate::{
    db::{migrations, plugin_repo, seed},
    error::{AppError, CommandResult},
    playback::engine::PlaybackEngine,
};
use rusqlite::Connection;
use std::{fs, sync::Mutex};
use tauri::{AppHandle, Manager, Runtime};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub playback: PlaybackEngine,
}

impl AppState {
    pub fn initialize<R: Runtime>(app: &AppHandle<R>) -> CommandResult<Self> {
        let data_dir = app.path().app_data_dir()?;
        fs::create_dir_all(&data_dir)?;
        let db_path = data_dir.join("iplayer.sqlite3");
        let conn = Connection::open(&db_path)?;

        migrations::run(&conn)?;
        seed::seed_demo_data(&conn, &seed::demo_seed())?;
        plugin_repo::seed_default_plugins(&conn)?;

        let playback = PlaybackEngine::new(app)?;

        Ok(Self {
            db: Mutex::new(conn),
            playback,
        })
    }
}

pub fn with_db<T>(
    state: &AppState,
    f: impl FnOnce(&Connection) -> CommandResult<T>,
) -> CommandResult<T> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::state("database state is unavailable"))?;
    f(&conn)
}
