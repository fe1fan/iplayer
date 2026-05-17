pub struct HookId;

#[allow(dead_code)]
impl HookId {
    pub const APP_INIT: &'static str = "app:init";
    pub const LIBRARY_SOURCE_RESOLVE: &'static str = "library:source-resolve";
    pub const LIBRARY_BEFORE_SCAN: &'static str = "library:before-scan";
    pub const LIBRARY_FILE_DISCOVERED: &'static str = "library:file-discovered";
    pub const LIBRARY_METADATA_READ: &'static str = "library:metadata-read";
    pub const LIBRARY_AFTER_LOAD: &'static str = "library:after-load";
    pub const METADATA_RESOLVE: &'static str = "metadata:resolve";
    pub const ARTWORK_RESOLVE: &'static str = "artwork:resolve";
    pub const LYRICS_RESOLVE: &'static str = "lyrics:resolve";
    pub const PLAYLIST_GENERATE: &'static str = "playlist:generate";
    pub const QUEUE_BEFORE_CHANGE: &'static str = "queue:before-change";
    pub const PLAYBACK_BEFORE_PLAY: &'static str = "playback:before-play";
    pub const DECODE_BEFORE: &'static str = "decode:before";
    pub const DECODE_AFTER: &'static str = "decode:after";
    pub const AUDIO_PROCESS_OUTPUT: &'static str = "audio:process-output";
    pub const AUDIO_BEFORE_DEVICE: &'static str = "audio:before-device";
    pub const PLAYBACK_AFTER_STOP: &'static str = "playback:after-stop";
    pub const TELEMETRY_SCROBBLE: &'static str = "telemetry:scrobble";
    pub const UI_CONTEXT_ACTIONS: &'static str = "ui:context-actions";
    pub const UI_PLUGIN_VIEW: &'static str = "ui:plugin-view";
}
