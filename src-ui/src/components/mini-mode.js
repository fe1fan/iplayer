import { setState, getState } from '../state.js';
import { formatDuration, getProgressPercent } from '../mock-data.js';
import { skipTrack, toggleLike, togglePlay } from '../player-actions.js';
import { ipcSeek, ipcSetVolume } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';
import { attachSlider } from './slider.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const song = s.playing.song;
  if (!song) return '';
  const playIcon = s.playing.isPlaying ? 'pause' : 'play';
  const playLabel = s.playing.isPlaying ? '暂停' : '播放';
  const isLiked = s.likedIds.has(song.id);
  const pct = getProgressPercent(s) * 100;
  const currentTime = formatDuration(Math.floor(s.playing.progress));
  const totalTime = formatDuration(s.playing.duration);
  const volPct = s.volume * 100;

  const openCls = s.mini ? ' open' : '';

  return `
  <div class="mini-mode${openCls}" id="miniMode" role="region" aria-label="迷你播放器" data-tauri-drag-region>
    <div class="mini-main">
      <button class="mini-cover ${song.coverClass}" data-action="restore" aria-label="打开播放视图">
        ${coverSvg(song.coverClass)}
      </button>
      <div class="mini-info" data-tauri-drag-region>
        <div class="title">${song.title}</div>
        <div class="artist">${song.artist}</div>
      </div>
      <button class="mini-icon-btn" aria-label="关闭迷你模式" data-action="close"><i data-lucide="x"></i></button>
    </div>
    <div class="mini-progress-row">
      <span class="mini-time" data-current-time>${currentTime}</span>
      <div class="mini-progress" id="miniProgress" aria-label="播放进度">
        <div class="fill" data-progress-fill style="width:${pct}%"></div>
      </div>
      <span class="mini-time">${totalTime}</span>
    </div>
    <div class="mini-controls">
      <button aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
      <button class="mini-play-btn" aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
      <button aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
      <button aria-label="歌词" data-action="lyrics"><i data-lucide="text"></i></button>
      <button aria-label="${isLiked ? '已收藏' : '收藏'}" class="${isLiked ? 'liked' : ''}" data-action="like"><i data-lucide="heart"></i></button>
      <div class="mini-volume">
        <button aria-label="音量"><i data-lucide="volume-2"></i></button>
        <div class="mini-vol-track" id="miniVolTrack"><div class="fill" style="width:${volPct}%"></div></div>
      </div>
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#miniMode');
  if (!el) return;

  el.querySelector('[data-action="restore"]')?.addEventListener('click', () => {
    const s = getState();
    if (s.playing.song) setState({ mini: false, expanded: true, lyrics: false });
  });
  const closeBtn = el.querySelector('[data-action="close"]');
  closeBtn?.addEventListener('pointerdown', e => e.stopPropagation());
  closeBtn?.addEventListener('mousedown', e => e.stopPropagation());
  closeBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    setState({ mini: false });
  });

  el.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    togglePlay();
  });

  el.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));
  el.querySelector('[data-action="lyrics"]')?.addEventListener('click', () => setState({ mini: false, lyrics: true, expanded: false }));

  const progress = el.querySelector('#miniProgress');
  const progressFill = progress?.querySelector('[data-progress-fill]');
  attachSlider(progress, progressFill, {
    onCommit(pct) {
      const s = getState();
      if (!s.playing.song || !s.playing.duration) return;
      const pos = Math.round(pct * s.playing.duration);
      setState({ playing: { ...s.playing, progress: pos } });
      if (isTauri()) ipcSeek(pos).catch(err => console.warn('[ipc] seek failed', err));
    },
  });

  const vol = el.querySelector('#miniVolTrack');
  const volFill = vol?.querySelector('.fill');
  attachSlider(vol, volFill, {
    onCommit(pct) {
      setState({ volume: pct });
      if (isTauri()) ipcSetVolume(pct).catch(err => console.warn('[ipc] set_volume failed', err));
    },
  });

  el.querySelector('[data-action="like"]')?.addEventListener('click', () => {
    toggleLike();
  });
}
