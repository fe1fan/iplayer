# iplayer Guide

## Stack
- **Backend**: Rust (Tauri 2.0, symphonia, rodio, lofty, rusqlite, notify)
- **Frontend**: Vanilla JS, Vite, Lucide icons
- **Packaging**: Tauri bundles for macOS (.dmg), Windows (.msi), Linux (.AppImage)

## Module Layout

### `src-tauri/src/`

```
lib.rs                # tauri::Builder setup, commands registration, lifecycle dispatch
main.rs               # process entry
error.rs              # AppError + CommandResult, From<…> conversions for rusqlite/io/tauri/lofty/notify/reqwest
state.rs              # AppState (db Mutex<Connection>, PlaybackEngine), with_db helper

commands/             # Tauri command handlers (1 file per domain)
  library.rs          # get_library, scan_library, pick_and_scan_library, search_songs
  metadata.rs         # get_song_metadata, match_musicbrainz, update_metadata
  lyrics.rs           # get_lyrics
  playlist.rs         # CRUD playlists, toggle_like
  playback.rs         # play_song, pause/resume/stop/seek/skip_track/set_volume/set_loop_mode/get_playback_state
  plugin.rs           # get_plugins, load_plugin_source, set_plugin_enabled, save_plugin_settings

db/
  migrations.rs       # schema, PRAGMA, ALTER TABLE column shims
  seed.rs             # LibrarySeed, seed_demo_data, demo_seed (idempotent on empty db)
  plugin_repo.rs      # plugins / plugin_hooks / plugin_settings CRUD + default plugin seed
  repository/         # library repository split by domain
    songs.rs          # list/get/search/update; upsert_song (pub(crate))
    albums.rs         # list_albums; upsert_album, rebuild_library_facets (pub(crate))
    playlists.rs      # CRUD + add/remove songs; upsert_playlist (pub(crate))
    liked.rs          # toggle_like / is_liked / set_liked
    folders.rs        # list_watched_folders
    import.rs         # import_scanned_songs, stable_hash
    tests.rs          # integration tests over an in-memory SQLite

library/
  scanner.rs          # directory walk, audio ext filter, lofty metadata read
  watcher.rs          # notify-based incremental rescan, emits library:changed event

playback/
  engine.rs           # PlaybackEngine: dedicated audio thread, rodio Sink, mpsc commands
  source.rs           # SymphoniaSource (rodio-compatible Decoder, byte_len preserved for seek)

lyrics/
  mod.rs              # find_for_song: read sibling .lrc, return Vec<LyricLine>
  lrc.rs              # LRC parser (multi-stamp lines, sort by time)

plugin/
  mod.rs              # pub use HookId, dispatch
  hooks.rs            # HookId constants (21 lifecycle hooks)
  registry.rs         # dispatch(app, hook_id, payload) → log + emit plugin:hook event

model/
  library.rs          # Song, Album, Playlist, MetadataPatch, LibrarySnapshot, ScanSummary
  playback.rs         # PlaybackStateSnapshot, LoopMode
  plugin.rs           # Plugin, PluginSourceInput
```

### `src-ui/src/`

```
main.js               # entry: applyPlatformClass + register state subs + global events + bootstrap
app-shell.js          # renderApp, scheduleRender, suppressRender, bindAll, platform class, subscriptions
bootstrap.js          # seed initial state, async subscribers (search/toast), getLibrary/Playlists/Plugins fetch
playback-events.js    # Tauri playback:progress / playback:state / library:changed listeners + mock progress timer
global-events.js      # document keydown (Escape/Space) and click-to-close ctx menu
window-mode.js        # mini window open/close, state hand-off snapshot
state.js              # plain store (subscribe/setState/getState)
ipc.js                # invoke wrappers with mock-data fallback per command
mock-data.js          # static demo data for browser preview / fallback
player-actions.js     # play/togglePlay/skip/seek/setVolume/toggleLike action helpers

components/
  titlebar.js         # custom titlebar incl. Win/Linux min/max/close
  sidebar.js          # library nav, playlists, system footer (plugins/settings)
  content.js          # view router: songs/albums/artists/folders/playlists/plugins/settings
  player-bar.js       # bottom transport bar
  now-playing.js      # expanded view
  lyrics.js           # lyrics view with timed LRC binary search
  metadata-panel.js   # metadata edit slide-over
  plugin-panel.js     # plugin manager overview + config page
  settings.js         # managed folders settings
  context-menu.js     # right-click menu
  mini-mode.js        # mini window render
  toast.js            # transient toast queue
  slider.js           # shared progress/volume drag helper

styles.css            # @import aggregator
styles/
  index.css           # @imports below in order
  tokens.css          # CSS vars (colors, fonts, radii, motion, sizes)
  reset.css           # base resets, scrollbar, focus-visible, selection
  app-shell.css       # .app grid, body.mini-window display:none overrides, non-mac rounded #app shell
  titlebar.css        # custom titlebar + Win/Linux control buttons
  sidebar.css         # sidebar + collapsed/resizing transitions + system footer
  content.css         # content frame, buttons, view-toggle
  library.css         # album grid, entity cards, song-list table, eq animation
  player-bar.css      # bottom np-bar incl. compact media queries
  overlay.css         # overlay base
  now-playing.css     # expanded now-playing view
  lyrics.css          # lyrics view + queue
  metadata-panel.css  # metadata side panel
  plugin-panel.css    # plugin manager + hook matrix
  mini-window.css     # mini-mode (in-window and dedicated window)
  context-menu.css    # right-click menu
  toast.css           # toast container + animation
  settings.css        # settings rows + toggle switch
```

## Development

```bash
# First-time setup
cd src-ui && pnpm install

# Run dev (vite + tauri together)
cd src-ui && pnpm dev &     # vite on :1420 (or set up beforeDevCommand)
cd src-tauri && cargo tauri dev
```

Linux system deps (Debian/Ubuntu): `libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev librsvg2-dev libayatana-appindicator3-dev libasound2-dev libxdo-dev libssl-dev libgtk-3-dev pkg-config build-essential`.

## Tests

```bash
cd src-tauri && cargo test         # Rust unit + repository integration tests
cd src-ui && pnpm build            # Vite production build (smoke check)
```

Repository tests cover seed/import/search/update/playlists/likes against an in-memory SQLite. LRC parser and playback queue/loop helpers have dedicated tests.

## Hooks (M8 plugin backend)

Hook IDs are declared in `src-tauri/src/plugin/hooks.rs`. Backend code calls `plugin::dispatch(app, HookId::…, payload)`; this logs `plugin hook dispatched: <id> → plugins=[…]` and emits a `plugin:hook` Tauri event with the active plugin ids. Active wiring points: app startup, library scan begin/end, playback before-play / after-stop.

## Conventions

- Tauri commands return `CommandResult<T>` (= `Result<T, AppError>`); errors serialize to `{code, message}` for the frontend.
- Repository functions cross sub-module via `pub(crate)` helpers; only top-level `db::repository::*` names are part of the surface used by commands.
- Frontend never imports `mock-data.js` for live data — it's only the `invokeOrFallback` fallback (browser preview) and the initial unauthenticated song seed.
- Drag regions on the custom titlebar use `data-tauri-drag-region`. Non-macOS hides the system decorations via Rust `set_decorations(false)` at startup.
