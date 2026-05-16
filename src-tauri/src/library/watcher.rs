use crate::{
    db::repository,
    error::CommandResult,
    library::scanner,
    state::{with_db, AppState},
};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    path::PathBuf,
    sync::mpsc,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const DEBOUNCE_MS: u64 = 2000;

pub struct LibraryWatcher {
    _watcher: RecommendedWatcher,
}

impl LibraryWatcher {
    pub fn start<R: Runtime>(app: &AppHandle<R>) -> CommandResult<Self> {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default(),
        )?;

        let state = app.state::<AppState>();
        let folders = with_db(&state, |conn| repository::list_watched_folders(conn))?;
        for (_id, path) in &folders {
            if let Err(e) = watcher.watch(PathBuf::from(path).as_ref(), RecursiveMode::Recursive) {
                log::warn!("failed to watch folder {path}: {e}");
            }
        }
        log::info!("watching {} folder(s) for changes", folders.len());

        let app = app.clone();
        std::thread::spawn(move || {
            let mut pending: Option<(PathBuf, Instant)> = None;

            loop {
                let timeout = pending
                    .as_ref()
                    .map(|(_, deadline)| {
                        Instant::now()
                            .checked_duration_since(*deadline)
                            .unwrap_or(Duration::ZERO)
                    })
                    .unwrap_or(Duration::from_secs(60));

                match rx.recv_timeout(timeout) {
                    Ok(event) => {
                        if is_relevant(&event) {
                            if let Some(path) = event.paths.first().cloned() {
                                let root = find_root(&path, &folders);
                                if let Some(root) = root {
                                    let deadline =
                                        Instant::now() + Duration::from_millis(DEBOUNCE_MS);
                                    pending = Some((root, deadline));
                                }
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if let Some((root, _)) = pending.take() {
                            rescan_folder(&app, &root);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }
}

fn is_relevant(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    ) && event
        .paths
        .iter()
        .any(|p| {
            p.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| {
                    matches!(
                        ext.to_ascii_lowercase().as_str(),
                        "mp3" | "flac" | "wav" | "ogg" | "aac" | "m4a" | "ape"
                    )
                })
                .unwrap_or(false)
        })
}

fn find_root(path: &std::path::Path, folders: &[(String, String)]) -> Option<PathBuf> {
    folders.iter().find_map(|(_, root)| {
        let root = PathBuf::from(root);
        path.starts_with(&root).then_some(root)
    })
}

fn rescan_folder<R: Runtime>(app: &AppHandle<R>, root: &std::path::Path) {
    log::info!("rescanning watched folder: {}", root.display());
    let state = app.state::<AppState>();
    match scanner::scan_path(root) {
        Ok(scan) => {
            let result = with_db(&state, |conn| {
                repository::import_scanned_songs(conn, &scan.root_path, &scan.songs)?;
                let songs = repository::list_songs(conn)?;
                let albums = repository::list_albums(conn)?;
                Ok((songs, albums))
            });
            match result {
                Ok((songs, albums)) => {
                    let total = songs.len();
                    let _ = app.emit("library:changed", serde_json::json!({
                        "total": total,
                        "imported": scan.songs.len(),
                        "skipped": scan.skipped,
                        "songs": songs,
                        "albums": albums,
                    }));
                    log::info!("rescan complete: {total} songs in library");
                }
                Err(e) => log::error!("rescan db write failed: {e}"),
            }
        }
        Err(e) => log::error!("rescan failed for {}: {e}", root.display()),
    }
}
