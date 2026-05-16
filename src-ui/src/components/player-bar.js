import { setState, getState } from '../state.js';
import { formatDuration, getProgressPercent } from '../mock-data.js';
import { cycleLoopMode, skipTrack, toggleLike, togglePlay, toggleShuffle } from '../player-actions.js';
import { ipcSeek, ipcSetVolume } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';
import { showToast } from './toast.js';
import { attachSlider } from './slider.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const p = s.playing;
  const song = p.song;
  const pct = getProgressPercent(s) * 100;
  const playIcon = p.isPlaying ? 'pause' : 'play';
  const playLabel = p.isPlaying ? '暂停' : '播放';
  const isLiked = song ? s.likedIds.has(song.id) : false;
  const volPct = Math.min(100, s.volume * 100);
  const curTime = formatDuration(p.progress);
  const totalTime = formatDuration(p.duration);
  const repeatIcon = s.loopMode === 'one' ? 'repeat-1' : 'repeat';
  const repeatLabel = s.loopMode === 'one' ? '单曲循环' : s.loopMode === 'off' ? '循环关闭' : '列表循环';

  return `
  <div class="np-bar" id="npBar" role="region" aria-label="当前播放">
    <div class="np-info">
      <div class="np-cover ${song?.coverClass || 'cover-a'}" id="npCover" role="button" tabindex="0" aria-label="展开播放视图">
        ${song?.coverUrl ? `<img src="${song.coverUrl}" style="width:100%;height:100%;object-fit:cover;">` : (song ? coverSvg(song.coverClass) : coverSvg('cover-a'))}
      </div>
      <div class="np-text">
        <div class="title" id="npTitle" role="button" tabindex="0">${song?.title || '未在播放'}</div>
        <div class="artist">${song ? song.artist : '选择一首歌曲开始播放'}</div>
      </div>
    </div>
    <div class="np-center">
      <div class="np-controls">
        <button class="ctrl-btn${s.shuffle ? ' active' : ''}" aria-label="随机播放" aria-pressed="${s.shuffle}" data-action="shuffle"><i data-lucide="shuffle"></i></button>
        <button class="ctrl-btn" aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
        <button class="ctrl-btn play-main" id="playBtn" aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
        <button class="ctrl-btn" aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
        <button class="ctrl-btn${s.loopMode !== 'off' ? ' active' : ''}" aria-label="${repeatLabel}" data-action="repeat"><i data-lucide="${repeatIcon}"></i></button>
      </div>
      <div class="np-progress-row">
        <span class="np-time" data-current-time>${curTime}</span>
        <div class="np-progress" id="progressBar" role="slider" aria-label="播放进度" aria-valuemin="0" aria-valuemax="${p.duration || 0}" aria-valuenow="${p.progress || 0}" tabindex="0">
          <div class="fill" id="progressFill" data-progress-fill style="width:${pct}%"></div>
        </div>
        <span class="np-time">${totalTime}</span>
      </div>
    </div>
    <div class="np-extras">
      <button class="extra-btn${isLiked ? ' liked' : ''}" aria-label="${isLiked ? '已收藏' : '收藏'}" data-action="like"><i data-lucide="heart"></i></button>
      <button class="extra-btn" aria-label="歌词" data-action="lyrics"><i data-lucide="text"></i></button>
      <button class="extra-btn${s.mini ? ' active' : ''}" aria-label="迷你模式" aria-pressed="${s.mini}" data-action="mini"><i data-lucide="minimize-2"></i></button>
      <div class="volume-wrap">
        <button class="extra-btn" aria-label="音量"><i data-lucide="volume-2"></i></button>
        <div class="vol-track" id="volTrack" role="slider" aria-label="音量" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.volume * 100)}" tabindex="0">
          <div class="fill" style="width:${volPct}%"></div>
        </div>
      </div>
    </div>
  </div>`;
}

export function bind(root) {
  const bar = root.querySelector('#npBar') || root.querySelector('.np-bar');
  if (!bar) return;

  bar.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => togglePlay());
  bar.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  bar.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));
  bar.querySelector('[data-action="shuffle"]')?.addEventListener('click', () => toggleShuffle());
  bar.querySelector('[data-action="repeat"]')?.addEventListener('click', () => cycleLoopMode());

  bar.querySelector('#npCover')?.addEventListener('click', () => {
    const s = getState();
    if (s.playing.song) setState({ expanded: true, lyrics: false, mini: false });
  });
  bar.querySelector('#npTitle')?.addEventListener('click', () => {
    const s = getState();
    if (s.playing.song) setState({ expanded: true, lyrics: false, mini: false });
  });

  bar.querySelector('[data-action="like"]')?.addEventListener('click', () => toggleLike());
  bar.querySelector('[data-action="lyrics"]')?.addEventListener('click', () => {
    const s = getState();
    if (s.playing.song) setState({ lyrics: !s.lyrics, expanded: false, mini: false });
  });
  bar.querySelector('[data-action="mini"]')?.addEventListener('click', () => {
    const s = getState();
    if (s.playing.song) setState({ mini: !s.mini, expanded: false, lyrics: false });
  });

  const progress = bar.querySelector('#progressBar');
  const progressFill = bar.querySelector('#progressFill');
  attachSlider(progress, progressFill, {
    onPreview(pct) {
      const s = getState();
      const cur = bar.querySelector('[data-current-time]');
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

  const vol = bar.querySelector('#volTrack');
  const volFill = vol?.querySelector('.fill');
  attachSlider(vol, volFill, {
    onCommit(pct) {
      setState({ volume: pct });
      if (isTauri()) {
        ipcSetVolume(pct).catch(err => console.warn('[ipc] set_volume failed', err));
      } else {
        showToast(`音量 ${Math.round(pct * 100)}%`);
      }
    },
  });
}
