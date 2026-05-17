import { setState, getState } from '../state.js';
import { formatDuration, getProgressPercent } from '../mock-data.js';
import { cycleLoopMode, skipTrack, togglePlay, toggleShuffle } from '../player-actions.js';
import { ipcSeek } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';
import { attachSlider } from './slider.js';
import { getAmplitude } from '../playback-events.js';

const VIZ_N = 240;
const VIZ_W = 800;
const VIZ_H = 96;
const VIZ_BASELINE = VIZ_H / 2;
const VIZ_GAIN = VIZ_H * 0.42;
const vizSamples = new Array(VIZ_N).fill(0);
let vizTarget = null;
let vizRaf = 0;
let vizPlaying = false;
let vizSampleIndex = 0;

function vizFrame() {
  if (!vizTarget || !vizTarget.isConnected) {
    vizRaf = 0;
    return;
  }
  const amp = vizPlaying ? getAmplitude() : 0;
  vizSampleIndex = (vizSampleIndex + 1) & 1;
  const sign = vizSampleIndex === 0 ? 1 : -1;
  const jitter = (Math.random() - 0.5) * 1.6;
  const target = amp * VIZ_GAIN * sign + jitter;
  // smooth into the previous value to avoid hard zigzag
  const prev = vizSamples[vizSamples.length - 1];
  const value = prev * 0.35 + target * 0.65;
  vizSamples.shift();
  vizSamples.push(value);

  let d = '';
  const stepX = VIZ_W / (VIZ_N - 1);
  for (let i = 0; i < VIZ_N; i++) {
    const x = (i * stepX).toFixed(1);
    const y = (VIZ_BASELINE - vizSamples[i]).toFixed(1);
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  vizTarget.setAttribute('d', d);
  vizRaf = requestAnimationFrame(vizFrame);
}

function attachVisualizer(root, isPlaying) {
  const path = root.querySelector('#vizPath');
  vizTarget = path || null;
  vizPlaying = !!isPlaying;
  if (vizTarget && !vizRaf) {
    vizRaf = requestAnimationFrame(vizFrame);
  }
}

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
  const playingCls = s.playing.isPlaying ? ' playing' : '';

  return `
  <div class="overlay np-expanded${openCls}${playingCls}" id="npExpanded" role="dialog" aria-label="播放视图" aria-modal="true">
    <div class="np-expanded-tools">
      <button class="np-tool-btn" data-action="lyrics" aria-label="歌词"><i data-lucide="text"></i></button>
      <button class="np-tool-btn" data-action="mini" aria-label="迷你模式"><i data-lucide="minimize-2"></i></button>
      <button class="np-tool-btn" data-action="close" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>
    <div class="np-visualizer" aria-hidden="true">
      <svg viewBox="0 0 ${VIZ_W} ${VIZ_H}" preserveAspectRatio="none">
        <path id="vizPath" d="M0 ${VIZ_BASELINE} L${VIZ_W} ${VIZ_BASELINE}"></path>
      </svg>
    </div>
    <div class="np-expanded-body">
      <div class="cover-lg ${song.coverClass}">
        ${song.coverUrl ? `<img src="${song.coverUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-md);">` : coverSvg(song.coverClass, 320)}
      </div>
      <div class="track-meta">
        <h2>${song.title}</h2>
        <p>${song.artist}<span class="dot">·</span>${song.album}</p>
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
  el.querySelector('[data-action="lyrics"]')?.addEventListener('click', () => setState({ expanded: false, lyrics: true }));
  el.querySelector('[data-action="mini"]')?.addEventListener('click', () => setState({ expanded: false, lyrics: false, mini: true }));

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

  attachVisualizer(el, getState().playing.isPlaying);
}
