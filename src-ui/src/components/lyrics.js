import { setState, getState } from '../state.js';
import { lyricsData, getProgressPercent, formatDuration } from '../mock-data.js';
import { getQueueSongs, playSong, skipTrack, togglePlay } from '../player-actions.js';
import { getLyrics, ipcSeek } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';
import { attachSlider } from './slider.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 28 28"><rect width="28" height="28" fill="${fill}"/></svg>`;
}

const cache = new Map();
let lastRequest = 0;

async function loadLyricsForSong(song) {
  if (!song?.id) return;
  if (cache.has(song.id)) return;
  cache.set(song.id, { status: 'loading' });
  const ticket = ++lastRequest;
  try {
    const result = await getLyrics(song.id);
    if (ticket !== lastRequest && cache.get(song.id)?.status === 'loading') return;
    cache.set(song.id, { status: 'ready', lines: normalizeLines(result, song.id) });
  } catch (error) {
    console.warn('[lyrics] load failed', error);
    cache.set(song.id, { status: 'ready', lines: null });
  }
  if (getState().lyrics) scheduleRerender();
}

function normalizeLines(result, songId) {
  if (Array.isArray(result) && result.length && typeof result[0] === 'object') {
    return result.map(line => ({ timeMs: Number(line.timeMs ?? line.time_ms ?? 0), text: line.text || '' }));
  }
  const fallback = result && Array.isArray(result) ? result : lyricsData[songId];
  if (Array.isArray(fallback) && fallback.length) {
    return fallback.map(text => ({ timeMs: null, text: typeof text === 'string' ? text : '' }));
  }
  return null;
}

function scheduleRerender() {
  setState({ lyrics: getState().lyrics });
}

function currentLineIndex(lines, song) {
  if (!lines?.length) return -1;
  if (lines[0].timeMs == null) {
    const pct = getProgressPercent({ playing: { song, progress: getState().playing.progress, duration: getState().playing.duration || song?.duration || 0 } });
    return Math.min(lines.length - 1, Math.max(0, Math.floor(pct * lines.length)));
  }
  const ms = (getState().playing.progress || 0) * 1000;
  let lo = 0, hi = lines.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= ms) { res = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return res;
}

export function render() {
  const s = getState();
  const song = s.playing.song;
  if (!song) return '';

  const entry = cache.get(song.id);
  if (!entry) loadLyricsForSong(song);
  const lines = entry?.status === 'ready' ? entry.lines : null;
  const loading = !entry || entry.status === 'loading';

  const playIcon = s.playing.isPlaying ? 'pause' : 'play';
  const playLabel = s.playing.isPlaying ? '暂停' : '播放';
  const pct = getProgressPercent(s) * 100;
  const currentLine = currentLineIndex(lines, song);
  const openCls = s.lyrics ? ' open' : '';
  const queue = getQueueSongs(s);

  let bodyContent;
  if (s.lyricsPanel === 'queue') {
    bodyContent = `
    <div class="lyrics-body queue-body">
      <div class="queue-list">
        ${queue.map((item, index) => `
          <button class="queue-row${item.id === song.id ? ' active' : ''}" data-song-id="${item.id}">
            <span class="queue-index">${index + 1}</span>
            <span class="queue-title">${item.title}</span>
            <span class="queue-artist">${item.artist}</span>
            <span class="queue-time">${formatDuration(item.duration)}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  } else if (loading) {
    bodyContent = `
    <div class="lyrics-body">
      <div class="lyrics-empty">
        <i data-lucide="loader"></i>
        <p>加载歌词…</p>
      </div>
    </div>`;
  } else if (!lines || lines.length === 0) {
    bodyContent = `
    <div class="lyrics-body">
      <div class="lyrics-empty">
        <i data-lucide="text"></i>
        <p>暂无歌词</p>
        <p class="lyrics-hint">把同名 .lrc 放在歌曲旁就会自动加载</p>
      </div>
    </div>`;
  } else {
    bodyContent = `
    <div class="lyrics-body" id="lyricsBody">
      ${lines.map((line, i) => {
        let cls = 'lyric-line';
        if (i < currentLine) cls += ' past';
        else if (i === currentLine) cls += ' current';
        return `<div class="${cls}">${line.text || '&nbsp;'}</div>`;
      }).join('')}
    </div>`;
  }

  return `
  <div class="overlay lyrics-view${openCls}" id="lyricsView" role="dialog" aria-label="歌词" aria-modal="true">
    <div class="lyrics-header">
      <div class="track-info">
        <div class="thumb ${song.coverClass}">
          ${song.coverUrl ? `<img src="${song.coverUrl}" style="width:100%;height:100%;object-fit:cover;">` : coverSvg(song.coverClass)}
        </div>
        <div class="meta">
          <div class="name">${song.title}</div>
          <div class="artist">${song.artist}</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="${s.lyricsPanel === 'queue' ? 'active' : ''}" data-action="show-queue" aria-label="播放队列"><i data-lucide="list"></i></button>
        <button class="${s.lyricsPanel !== 'queue' ? 'active' : ''}" data-action="show-lyrics" aria-label="歌词"><i data-lucide="text"></i></button>
        <button data-action="close" aria-label="关闭歌词"><i data-lucide="x"></i></button>
      </div>
    </div>
    ${bodyContent}
    <div class="lyrics-bottom">
      <div class="mini-prog" id="lyricsProg"><div class="fill" data-progress-fill style="width:${pct}%"></div></div>
      <div class="lyric-controls">
        <button aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
        <button aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
        <button aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
      </div>
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#lyricsView');
  if (!el) return;

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => setState({ lyrics: false }));
  el.querySelector('[data-action="show-queue"]')?.addEventListener('click', () => setState({ lyricsPanel: 'queue' }));
  el.querySelector('[data-action="show-lyrics"]')?.addEventListener('click', () => setState({ lyricsPanel: 'lyrics' }));

  el.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    togglePlay();
  });

  el.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));

  const lyricsProg = el.querySelector('#lyricsProg');
  const lyricsFill = lyricsProg?.querySelector('[data-progress-fill]');
  attachSlider(lyricsProg, lyricsFill, {
    onCommit(pct) {
      const s = getState();
      if (!s.playing.song || !s.playing.duration) return;
      const pos = Math.round(pct * s.playing.duration);
      setState({ playing: { ...s.playing, progress: pos } });
      if (isTauri()) ipcSeek(pos).catch(err => console.warn('[ipc] seek failed', err));
    },
  });

  el.querySelectorAll('.queue-row[data-song-id]').forEach(row => {
    row.addEventListener('click', () => playSong(row.dataset.songId, getQueueSongs()));
  });
}
