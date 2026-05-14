# iplayer

A lightweight cross-platform music player built with Tauri + Rust.

## Features

- Local music library management with smart metadata recognition
- Immersive lyrics experience
- Minimal, quiet UI (Quiet Warmth design)

## Tech Stack

- **Backend**: Rust (Tauri 2.0, symphonia, rodio, lofty, rusqlite)
- **Frontend**: Vanilla JS + Vite + Lucide icons

## Development

```bash
# Install dependencies
cd src-ui && pnpm install

# Run dev server
cd src-tauri && cargo tauri dev
```

## License

MIT
