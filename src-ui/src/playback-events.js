import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getState, setState } from './state.js';
import { formatDuration } from './mock-data.js';
import { skipTrack } from './player-actions.js';
import { showToast } from './components/toast.js';

function paintProgress(position, duration) {
  const pct = duration > 0 ? (position / duration * 100) + '%' : '0%';
  document.querySelectorAll('[data-progress-fill]').forEach(fill => { fill.style.width = pct; });
  document.querySelectorAll('[data-current-time]').forEach(el => { el.textContent = formatDuration(position); });
}

export function startPlaybackEvents() {
  if (isTauri()) registerTauriListeners();
  else startMockProgressTimer();
}

function registerTauriListeners() {
  const win = getCurrentWindow();

  win.listen('playback:progress', event => {
    const d = event.payload;
    if (!d) return;
    const s = getState();
    if (!s.playing.song || s.playing.song.id !== d.songId) return;
    // Mutate in place so subscribers don't re-render every 500ms.
    s.playing.progress = d.position;
    s.playing.duration = d.duration;
    s.playing.isPlaying = d.isPlaying;
    if (typeof d.volume === 'number') s.volume = d.volume;
    paintProgress(d.position, d.duration);
  });

  win.listen('playback:state', event => {
    const d = event.payload;
    if (!d) return;
    if (d.song) {
      const s = getState();
      const recentIds = [d.song.id, ...s.recentIds.filter(id => id !== d.song.id)].slice(0, 20);
      setState({
        playing: {
          song: d.song,
          isPlaying: d.isPlaying ?? true,
          progress: d.position ?? 0,
          duration: d.duration ?? d.song.duration,
        },
        queueIndex: d.queueIndex ?? s.queueIndex,
        recentIds,
      });
    } else {
      setState({ playing: { ...getState().playing, isPlaying: false } });
    }
  });

  win.listen('library:changed', event => {
    const data = event.payload;
    if (!data) return;
    setState({
      librarySongs: data.songs || getState().librarySongs,
      libraryAlbums: data.albums || getState().libraryAlbums,
    });
    showToast(`曲库已更新（${data.imported ?? 0} 首新增）`);
  });
}

function startMockProgressTimer() {
  setInterval(() => {
    const s = getState();
    if (!s.playing.isPlaying || !s.playing.song) return;
    const progress = s.playing.progress + 1;
    if (progress >= s.playing.duration) {
      if (s.loopMode === 'off') {
        setState({ playing: { ...s.playing, progress: s.playing.duration, isPlaying: false } });
      } else {
        skipTrack(1);
      }
    } else {
      s.playing.progress = progress;
      paintProgress(progress, s.playing.duration);
    }
  }, 1000);
}
