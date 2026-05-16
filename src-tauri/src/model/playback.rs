use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub song_id: Option<String>,
    pub is_playing: bool,
    pub progress: u64,
    pub duration: u64,
    pub volume: f32,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            song_id: None,
            is_playing: false,
            progress: 0,
            duration: 0,
            volume: 0.7,
        }
    }
}
