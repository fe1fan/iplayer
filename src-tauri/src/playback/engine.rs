use crate::{
    db::repository,
    error::{AppError, CommandResult},
    model::library::Song,
    playback::source::SymphoniaSource,
};
use rodio::{OutputStream, Sink, Source};
use std::{
    path::Path,
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const PROGRESS_INTERVAL: Duration = Duration::from_millis(500);
const TICK_INTERVAL: Duration = Duration::from_millis(100);

pub struct PlaybackEngine {
    tx: mpsc::Sender<AudioCommand>,
    state: Arc<Mutex<SharedState>>,
}

enum AudioCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(Duration),
    SetVolume(f32),
}

struct SharedState {
    current_song: Option<Song>,
    queue: Vec<String>,
    queue_index: usize,
    loop_mode: LoopMode,
    volume: f32,
    is_playing: bool,
    auto_advance: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum LoopMode {
    Off,
    List,
    One,
}

impl LoopMode {
    fn parse(s: &str) -> Self {
        match s {
            "one" => Self::One,
            "list" => Self::List,
            _ => Self::Off,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::List => "list",
            Self::One => "one",
        }
    }
}

impl PlaybackEngine {
    pub fn new<R: Runtime>(app: &AppHandle<R>) -> CommandResult<Self> {
        let (tx, rx) = mpsc::channel();
        let state = Arc::new(Mutex::new(SharedState {
            current_song: None,
            queue: Vec::new(),
            queue_index: 0,
            loop_mode: LoopMode::Off,
            volume: 1.0,
            is_playing: false,
            auto_advance: false,
        }));

        let app = app.clone();
        let thread_state = state.clone();
        std::thread::spawn(move || run_audio_thread(app, thread_state, rx));

        Ok(Self { tx, state })
    }

    fn send(&self, cmd: AudioCommand) -> CommandResult<()> {
        self.tx
            .send(cmd)
            .map_err(|_| AppError::state("audio thread disconnected"))
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
        self.send(AudioCommand::Play(path))?;

        let mut state = self.state.lock().unwrap();
        state.current_song = Some(song);
        state.queue = queue;
        state.queue_index = queue_index;
        state.is_playing = true;
        state.auto_advance = true;
        Ok(())
    }

    pub fn pause(&self) -> CommandResult<()> {
        self.send(AudioCommand::Pause)?;
        self.state.lock().unwrap().is_playing = false;
        Ok(())
    }

    pub fn resume(&self) -> CommandResult<()> {
        self.send(AudioCommand::Resume)?;
        self.state.lock().unwrap().is_playing = true;
        Ok(())
    }

    pub fn stop(&self) -> CommandResult<()> {
        self.send(AudioCommand::Stop)?;
        let mut state = self.state.lock().unwrap();
        state.current_song = None;
        state.is_playing = false;
        state.auto_advance = false;
        Ok(())
    }

    pub fn seek(&self, position: Duration) -> CommandResult<()> {
        self.send(AudioCommand::Seek(position))
    }

    pub fn set_volume(&self, volume: f32) -> CommandResult<()> {
        let volume = volume.clamp(0.0, 2.0);
        self.send(AudioCommand::SetVolume(volume))?;
        self.state.lock().unwrap().volume = volume;
        Ok(())
    }

    pub fn skip_track(&self, delta: i32, conn: &rusqlite::Connection) -> CommandResult<()> {
        let (queue, current_index, loop_mode) = {
            let state = self.state.lock().unwrap();
            (state.queue.clone(), state.queue_index, state.loop_mode)
        };

        if queue.is_empty() {
            return self.stop();
        }

        let new_index = next_index(current_index, queue.len(), delta, loop_mode)
            .unwrap_or(current_index);
        let Some(song_id) = queue.get(new_index).cloned() else {
            return self.stop();
        };
        let Some(song) = repository::get_song(conn, &song_id)? else {
            return self.stop();
        };
        self.play_song(song, queue, new_index)
    }

    pub fn set_loop_mode(&self, mode: &str) -> CommandResult<()> {
        self.state.lock().unwrap().loop_mode = LoopMode::parse(mode);
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
            loop_mode: state.loop_mode.as_str().to_string(),
        }
    }
}

fn next_index(current: usize, len: usize, delta: i32, mode: LoopMode) -> Option<usize> {
    if len == 0 {
        return None;
    }
    if matches!(mode, LoopMode::One) {
        return Some(current);
    }
    let target = current as i64 + delta as i64;
    if target < 0 {
        Some(len - 1)
    } else if target >= len as i64 {
        match mode {
            LoopMode::Off => Some(current),
            _ => Some(0),
        }
    } else {
        Some(target as usize)
    }
}

fn run_audio_thread<R: Runtime>(
    app: AppHandle<R>,
    state: Arc<Mutex<SharedState>>,
    rx: mpsc::Receiver<AudioCommand>,
) {
    let Ok((stream, handle)) = OutputStream::try_default() else {
        log::error!("no audio output device available");
        return;
    };
    let _stream = stream;
    let Ok(sink) = Sink::try_new(&handle) else {
        log::error!("failed to create audio sink");
        return;
    };
    sink.set_volume(1.0);

    let mut last_emit = Instant::now() - PROGRESS_INTERVAL;

    loop {
        // Drain pending commands without blocking.
        loop {
            match rx.try_recv() {
                Ok(cmd) => apply_command(&sink, cmd),
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => return,
            }
        }

        let now = Instant::now();
        if now.duration_since(last_emit) >= PROGRESS_INTERVAL {
            emit_progress(&app, &state, &sink);
            last_emit = now;
        }

        if !sink.is_paused() {
            check_track_end(&app, &state, &sink);
        }

        std::thread::sleep(TICK_INTERVAL);
    }
}

fn apply_command(sink: &Sink, cmd: AudioCommand) {
    match cmd {
        AudioCommand::Play(path) => match open_audio_source(&path) {
            Ok(source) => {
                sink.stop();
                sink.append(source);
                sink.play();
            }
            Err(e) => log::error!("playback open failed: {e}"),
        },
        AudioCommand::Pause => sink.pause(),
        AudioCommand::Resume => sink.play(),
        AudioCommand::Stop => sink.stop(),
        AudioCommand::Seek(pos) => {
            if let Err(e) = sink.try_seek(pos) {
                log::warn!("seek failed: {e}");
            }
        }
        AudioCommand::SetVolume(v) => sink.set_volume(v.clamp(0.0, 2.0)),
    }
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, state: &Arc<Mutex<SharedState>>, sink: &Sink) {
    let inner = state.lock().unwrap();
    let Some(ref song) = inner.current_song else {
        return;
    };
    let position = sink.get_pos().as_secs();
    let payload = serde_json::json!({
        "songId": song.id,
        "position": position,
        "duration": song.duration,
        "isPlaying": !sink.is_paused(),
        "volume": inner.volume,
    });
    drop(inner);
    let _ = app.emit("playback:progress", payload);
}

fn check_track_end<R: Runtime>(
    app: &AppHandle<R>,
    state: &Arc<Mutex<SharedState>>,
    sink: &Sink,
) {
    if !sink.empty() {
        return;
    }

    let (queue, queue_index, loop_mode, has_song, auto_advance) = {
        let inner = state.lock().unwrap();
        (
            inner.queue.clone(),
            inner.queue_index,
            inner.loop_mode,
            inner.current_song.is_some(),
            inner.auto_advance,
        )
    };

    if !has_song || !auto_advance {
        return;
    }

    let at_end = queue_index + 1 >= queue.len();
    let should_stop = queue.is_empty() || (loop_mode == LoopMode::Off && at_end);
    if should_stop {
        let mut inner = state.lock().unwrap();
        inner.current_song = None;
        inner.is_playing = false;
        inner.auto_advance = false;
        drop(inner);
        let _ = app.emit("playback:state", serde_json::json!({"song": null, "isPlaying": false}));
        return;
    }

    let next = next_index(queue_index, queue.len(), 1, loop_mode).unwrap_or(queue_index);
    let Some(song_id) = queue.get(next).cloned() else {
        return;
    };

    let db_state = app.state::<crate::state::AppState>();
    let db = db_state.db.lock().unwrap();
    let Ok(Some(song)) = repository::get_song(&db, &song_id) else {
        return;
    };
    drop(db);

    let Some(ref path) = song.file_path else {
        return;
    };
    let Ok(source) = open_audio_source(path) else {
        return;
    };
    let dur = source
        .total_duration()
        .map(|d| d.as_secs())
        .unwrap_or(song.duration);
    sink.stop();
    sink.append(source);
    sink.play();

    let mut inner = state.lock().unwrap();
    let mut s = song.clone();
    s.duration = dur;
    inner.current_song = Some(s);
    inner.queue_index = next;
    inner.is_playing = true;
    inner.auto_advance = true;
    drop(inner);

    let _ = app.emit(
        "playback:state",
        serde_json::json!({
            "song": song,
            "isPlaying": true,
            "position": 0,
            "duration": dur,
            "queueIndex": next,
        }),
    );
}

fn open_audio_source(path: &str) -> CommandResult<SymphoniaSource> {
    SymphoniaSource::from_path(Path::new(path)).map_err(AppError::state)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_index_off_clamps_at_end() {
        assert_eq!(next_index(2, 3, 1, LoopMode::Off), Some(2));
        assert_eq!(next_index(0, 3, -1, LoopMode::Off), Some(2));
    }

    #[test]
    fn next_index_list_wraps() {
        assert_eq!(next_index(2, 3, 1, LoopMode::List), Some(0));
        assert_eq!(next_index(0, 3, -1, LoopMode::List), Some(2));
    }

    #[test]
    fn next_index_one_repeats() {
        assert_eq!(next_index(1, 3, 1, LoopMode::One), Some(1));
        assert_eq!(next_index(1, 3, -1, LoopMode::One), Some(1));
    }

    #[test]
    fn next_index_empty_returns_none() {
        assert_eq!(next_index(0, 0, 1, LoopMode::Off), None);
    }

    #[test]
    fn loop_mode_round_trips() {
        for s in &["off", "list", "one"] {
            assert_eq!(LoopMode::parse(s).as_str(), *s);
        }
    }
}
