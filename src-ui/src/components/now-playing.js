import { setState, getState } from '../state.js';
import { formatDuration, getProgressPercent } from '../mock-data.js';
import { cycleLoopMode, skipTrack, togglePlay, toggleShuffle } from '../player-actions.js';
import { ipcSeek } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';
import { attachSlider } from './slider.js';

function coverSvg(cls, size) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const song = s.playing.song;
  if (!song) return '';
  const pct = getProgressPercent(s) * 100;
  const currentTime = formatDuration(Math.floor(s.playing.progress));
  const totalTime = formatDuration(s.playing.duration);
  const playIcon = s.playing.isPlaying ? 'pause' : 'play';
  const playLabel = s.playing.isPlaying ? '暂停' : '播放';
  const openCls = s.expanded ? ' open' : '';
  const repeatIcon = s.loopMode === 'one' ? 'repeat-1' : 'repeat';
  const repeatLabel = s.loopMode === 'one' ? '单曲循环' : s.loopMode === 'off' ? '循环关闭' : '列表循环';

  return `
  <div class="overlay np-expanded${openCls}" id="npExpanded" role="dialog" aria-label="播放视图" aria-modal="true">
    <button class="close-btn" data-action="close" aria-label="关闭"><i data-lucide="x"></i></button>
    <div class="np-expanded-body">
      <div class="cover-lg ${song.coverClass}">
        ${coverSvg(song.coverClass, 220)}
      </div>
      <div class="track-meta">
        <h2>${song.title}</h2>
        <p>${song.artist} · ${song.album}</p>
      </div>
      <div class="exp-progress">
        <div class="exp-progress-track" id="expProgressTrack"><div class="fill" data-progress-fill style="width:${pct}%"></div></div>
        <div class="exp-time"><span data-current-time>${currentTime}</span><span>${totalTime}</span></div>
      </div>
      <div class="exp-controls">
        <button class="ctrl-btn${s.shuffle ? ' active' : ''}" aria-label="随机播放" data-action="shuffle"><i data-lucide="shuffle"></i></button>
        <button class="ctrl-btn" aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
        <button class="play-main-lg" id="playBtnExp" aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
        <button class="ctrl-btn" aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
        <button class="ctrl-btn${s.loopMode !== 'off' ? ' active' : ''}" aria-label="${repeatLabel}" data-action="repeat"><i data-lucide="${repeatIcon}"></i></button>
      </div>
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#npExpanded');
  if (!el) return;

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => setState({ expanded: false }));

  el.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    togglePlay();
  });

  el.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));
  el.querySelector('[data-action="shuffle"]')?.addEventListener('click', () => toggleShuffle());
  el.querySelector('[data-action="repeat"]')?.addEventListener('click', () => cycleLoopMode());

  const track = el.querySelector('#expProgressTrack');
  const fill = track?.querySelector('.fill');
  attachSlider(track, fill, {
    onPreview(pct) {
      const s = getState();
      const cur = el.querySelector('[data-current-time]');
      if (cur) cur.textContent = formatDuration(Math.round(pct * (s.playing.duration || 0)));
    },
    onCommit(pct) {
      const s = getState();
      if (!s.playing.song || !s.playing.duration) return;
      const progress = Math.round(pct * s.playing.duration);
      setState({ playing: { ...s.playing, progress } });
      if (isTauri()) {
        ipcSeek(progress).catch(err => console.warn('[ipc] seek failed', err));
      }
    },
  });
}
