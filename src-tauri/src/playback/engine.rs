use crate::{
    db::repository,
    error::{AppError, CommandResult},
    model::library::Song,
};
use rodio::{Decoder, OutputStream, Sink, Source};
use tauri::Manager;
use std::{
    fs::File,
    io::BufReader,
    path::Path,
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Runtime};

pub struct PlaybackEngine {
    tx: mpsc::Sender<AudioCommand>,
    state: Arc<Mutex<SharedState>>,
}

enum AudioCommand {
    Play {
        path: String,
    },
    Pause,
    Resume,
    Stop,
    Seek {
        position: Duration,
    },
    SetVolume {
        volume: f32,
    },
    Shutdown,
}

struct SharedState {
    current_song: Option<Song>,
    queue: Vec<String>,
    queue_index: usize,
    loop_mode: LoopMode,
    volume: f32,
    is_playing: bool,
    stopping: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum LoopMode {
    Off,
    List,
    One,
}

impl PlaybackEngine {
    pub fn new<R: Runtime>(app: &AppHandle<R>) -> CommandResult<Self> {
        let (tx, rx) = mpsc::channel();

        let state = Arc::new(Mutex::new(SharedState {
            current_song: None,
            queue: Vec::new(),
            queue_index: 0,
            loop_mode: LoopMode::Off,
            volume: 0.7,
            is_playing: false,
            stopping: false,
        }));

        let app = app.clone();
        let thread_state = state.clone();
        std::thread::spawn(move || {
            let Ok((stream, handle)) = OutputStream::try_default() else {
                log::error!("no audio output device available");
                return;
            };
            let Ok(sink) = Sink::try_new(&handle) else {
                log::error!("failed to create audio sink");
                return;
            };
            sink.set_volume(0.7);

            let _stream = stream;
            let mut last_emit = std::time::Instant::now()
                - Duration::from_millis(500);

            loop {
                while let Ok(cmd) = rx.try_recv() {
                    match cmd {
                        AudioCommand::Play { path } => match open_audio_source(&path) {
                            Ok(source) => {
                                sink.stop();
                                sink.append(source);
                            }
                            Err(e) => log::error!("playback open failed: {e}"),
                        },
                        AudioCommand::Pause => sink.pause(),
                        AudioCommand::Resume => sink.play(),
                        AudioCommand::Stop => {
                            sink.stop();
                        }
                        AudioCommand::Seek { position } => {
                            if let Err(e) = sink.try_seek(position) {
                                log::warn!("seek failed: {e}");
                            }
                        }
                        AudioCommand::SetVolume { volume } => {
                            sink.set_volume(volume.clamp(0.0, 1.0));
                        }
                        AudioCommand::Shutdown => return,
                    }
                }

                let now = std::time::Instant::now();
                let should_emit = now.duration_since(last_emit) >= Duration::from_millis(500);

                if should_emit && !sink.is_paused() {
                    let inner = thread_state.lock().unwrap();
                    if let Some(ref song) = inner.current_song {
                        let position = sink.get_pos().as_secs();
                        let duration = song.duration;
                        let is_playing = !sink.is_paused();
                        let volume = inner.volume;
                        let song_id = song.id.clone();

                        let _ = app.emit(
                            "playback:progress",
                            serde_json::json!({
                                "songId": song_id,
                                "position": position,
                                "duration": duration,
                                "isPlaying": is_playing,
                                "volume": volume,
                            }),
                        );
                    }
                    drop(inner);
                    last_emit = now;
                }

                if !sink.is_paused() {
                    let inner = thread_state.lock().unwrap();
                    let has_song = inner.current_song.is_some();
                    let stopping = inner.stopping;
                    let queue = inner.queue.clone();
                    let queue_index = inner.queue_index;
                    let loop_mode = inner.loop_mode;
                    drop(inner);

                    if has_song && !stopping && sink.empty() {
                        let queue_empty = queue.is_empty();
                        let at_end = queue_index >= queue.len().saturating_sub(1);

                        if queue_empty || (loop_mode == LoopMode::Off && at_end) {
                            let mut inner = thread_state.lock().unwrap();
                            inner.current_song = None;
                            inner.is_playing = false;
                            inner.stopping = true;
                            drop(inner);

                            let _ = app.emit("playback:state", serde_json::json!({
                                "song": null,
                                "isPlaying": false,
                            }));
                        } else {
                            let next_index = match loop_mode {
                                LoopMode::One => queue_index,
                                _ => {
                                    if queue_index + 1 < queue.len() {
                                        queue_index + 1
                                    } else {
                                        0
                                    }
                                }
                            };
                            let Some(song_id) = queue.get(next_index).cloned() else {
                                continue;
                            };

                            let db_state = app.state::<crate::state::AppState>();
                            let db = db_state.db.lock().unwrap();
                            if let Some(song) =
                                repository::get_song(&db, &song_id).unwrap_or(None)
                            {
                                if let Some(ref path) = song.file_path {
                                    if let Ok(source) = open_audio_source(path) {
                                        let dur = source
                                            .total_duration()
                                            .unwrap_or(Duration::from_secs(song.duration))
                                            .as_secs();
                                        sink.stop();
                                        sink.append(source);

                                        let mut inner =
                                            thread_state.lock().unwrap();
                                        let mut s = song.clone();
                                        s.duration = dur;
                                        inner.current_song = Some(s);
                                        inner.queue_index = next_index;
                                        inner.is_playing = true;
                                        inner.stopping = false;
                                        drop(inner);

                                        let _ = app.emit(
                                            "playback:state",
                                            serde_json::json!({
                                                "song": song,
                                                "isPlaying": true,
                                                "position": 0,
                                                "duration": dur,
                                                "queueIndex": next_index,
                                            }),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }

                std::thread::sleep(Duration::from_millis(200));
            }
        });

        Ok(Self { tx, state })
    }

    pub fn play_song(
        &self,
        song: Song,
        queue: Vec<String>,
        queue_index: usize,
    ) -> CommandResult<()> {
        let path = song
            .file_path
            .clone()
            .ok_or_else(|| AppError::state("song has no local file path"))?;

        self.tx
            .send(AudioCommand::Play { path })
            .map_err(|_| AppError::state("audio thread disconnected"))?;

        let mut state = self.state.lock().unwrap();
        state.current_song = Some(song);
        state.queue = queue;
        state.queue_index = queue_index;
        state.is_playing = true;
        state.stopping = false;

        Ok(())
    }

    pub fn pause(&self) -> CommandResult<()> {
        self.tx
            .send(AudioCommand::Pause)
            .map_err(|_| AppError::state("audio thread disconnected"))?;
        self.state.lock().unwrap().is_playing = false;
        Ok(())
    }

    pub fn resume(&self) -> CommandResult<()> {
        self.tx
            .send(AudioCommand::Resume)
            .map_err(|_| AppError::state("audio thread disconnected"))?;
        self.state.lock().unwrap().is_playing = true;
        Ok(())
    }

    pub fn stop(&self) -> CommandResult<()> {
        self.tx
            .send(AudioCommand::Stop)
            .map_err(|_| AppError::state("audio thread disconnected"))?;
        let mut state = self.state.lock().unwrap();
        state.current_song = None;
        state.is_playing = false;
        state.stopping = true;
        Ok(())
    }

    pub fn seek(&self, position: Duration) -> CommandResult<()> {
        self.tx
            .send(AudioCommand::Seek { position })
            .map_err(|_| AppError::state("audio thread disconnected"))?;
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) -> CommandResult<()> {
        let volume = volume.clamp(0.0, 1.0);
        self.tx
            .send(AudioCommand::SetVolume { volume })
            .map_err(|_| AppError::state("audio thread disconnected"))?;
        self.state.lock().unwrap().volume = volume;
        Ok(())
    }

    pub fn skip_track(&self, delta: i32, conn: &rusqlite::Connection) -> CommandResult<()> {
        let (queue, current_index, loop_mode) = {
            let state = self.state.lock().unwrap();
            (state.queue.clone(), state.queue_index, state.loop_mode)
        };

        if queue.is_empty() {
            self.stop()?;
            return Ok(());
        }

        let new_index = match loop_mode {
            LoopMode::One => current_index,
            _ => {
                let current = current_index as i64 + delta as i64;
                if current < 0 {
                    queue.len() - 1
                } else if current >= queue.len() as i64 {
                    match loop_mode {
                        LoopMode::Off => current_index,
                        _ => 0,
                    }
                } else {
                    current as usize
                }
            }
        };

        let Some(song_id) = queue.get(new_index).cloned() else {
            self.stop()?;
            return Ok(());
        };
        let song = repository::get_song(conn, &song_id).unwrap_or(None);
        self.skip_to(song, queue, new_index)
    }

    fn skip_to(
        &self,
        song: Option<Song>,
        queue: Vec<String>,
        next_index: usize,
    ) -> CommandResult<()> {
        if let Some(song) = song {
            let path = song
                .file_path
                .clone()
                .ok_or_else(|| AppError::state("song has no local file path"))?;
            self.tx
                .send(AudioCommand::Play { path })
                .map_err(|_| AppError::state("audio thread disconnected"))?;
            let mut state = self.state.lock().unwrap();
            state.current_song = Some(song);
            state.queue = queue;
            state.queue_index = next_index;
            state.is_playing = true;
            state.stopping = false;
        } else {
            self.stop()?;
        }
        Ok(())
    }

    pub fn set_loop_mode(&self, mode: &str) -> CommandResult<()> {
        let mut state = self.state.lock().unwrap();
        state.loop_mode = match mode {
            "one" => LoopMode::One,
            "list" => LoopMode::List,
            _ => LoopMode::Off,
        };
        Ok(())
    }

    pub fn get_state(&self) -> PlaybackStateSnapshot {
        let state = self.state.lock().unwrap();
        PlaybackStateSnapshot {
            song: state.current_song.clone(),
            is_playing: state.is_playing,
            queue: state.queue.clone(),
            queue_index: state.queue_index,
            volume: state.volume,
            loop_mode: match state.loop_mode {
                LoopMode::Off => "off",
                LoopMode::List => "list",
                LoopMode::One => "one",
            }
            .to_string(),
        }
    }
}

fn open_audio_source(path: &str) -> CommandResult<Decoder<BufReader<File>>> {
    let file = File::open(Path::new(path))
        .map_err(|e| AppError::state(format!("cannot open file: {e}")))?;
    Decoder::new(BufReader::new(file))
        .map_err(|e| AppError::state(format!("unsupported audio format: {e}")))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStateSnapshot {
    pub song: Option<Song>,
    pub is_playing: bool,
    pub queue: Vec<String>,
    pub queue_index: usize,
    pub volume: f32,
    pub loop_mode: String,
}
