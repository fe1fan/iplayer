# iplayer

A lightweight cross-platform music player built with Tauri + Rust.

## Features

- Local music library management with smart metadata recognition
- Immersive lyrics experience (LRC parsing, timed highlight)
- Plugin system with lifecycle hooks
- Minimal, quiet UI (Quiet Warmth design)

## Tech Stack

- **Backend**: Rust (Tauri 2.0, symphonia, rodio, lofty, rusqlite, notify)
- **Frontend**: Vanilla JS + Vite + Lucide icons

## Project Layout

See [AGENTS.md](./AGENTS.md) for the full module map. Quick map:

```
src-tauri/src/
  commands/{library,metadata,lyrics,playlist,playback,plugin}.rs
  db/{migrations,seed,plugin_repo}.rs
  db/repository/{songs,albums,playlists,liked,folders,import,tests}.rs
  library/{scanner,watcher}.rs
  playback/{engine,source}.rs
  lyrics/{lrc,mod}.rs
  plugin/{registry,hooks,mod}.rs
  model/{library,playback,plugin}.rs
  {error,state,lib,main}.rs

src-ui/src/
  main.js · app-shell.js · bootstrap.js · playback-events.js · global-events.js
  ipc.js · state.js · player-actions.js · window-mode.js · mock-data.js
  components/{titlebar,sidebar,content,player-bar,now-playing,lyrics,
              metadata-panel,plugin-panel,settings,context-menu,mini-mode,
              toast,slider}.js
  styles.css -> styles/{tokens,reset,app-shell,titlebar,sidebar,content,
                        library,player-bar,overlay,now-playing,lyrics,
                        metadata-panel,plugin-panel,mini-window,
                        context-menu,toast,settings}.css
```

## Development

```bash
# Install frontend deps
cd src-ui && pnpm install

# Run dev (vite then tauri)
cd src-ui && pnpm dev
cd src-tauri && cargo tauri dev
```

### Tests

```bash
cd src-tauri && cargo test
cd src-ui && pnpm build
```

### Linux system deps (Debian/Ubuntu)

```
sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev librsvg2-dev libayatana-appindicator3-dev \
  libasound2-dev libxdo-dev libssl-dev libgtk-3-dev pkg-config build-essential
```

## License

MIT
