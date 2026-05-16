import { setState, getState } from '../state.js';
import { formatDuration, getProgressPercent } from '../mock-data.js';
import { cycleLoopMode, setProgressByPointer, setVolumeByPointer, skipTrack, toggleLike, togglePlay, toggleShuffle } from '../player-actions.js';

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
  const volPct = s.volume * 100;
  const curTime = formatDuration(p.progress);
  const totalTime = formatDuration(p.duration);
  const repeatIcon = s.loopMode === 'one' ? 'repeat-1' : 'repeat';
  const repeatLabel = s.loopMode === 'one' ? '单曲循环' : s.loopMode === 'off' ? '循环关闭' : '列表循环';

  return `
  <div class="np-bar" id="npBar" role="region" aria-label="当前播放">
    <div class="np-info">
      <div class="np-cover ${song?.coverClass || 'cover-a'}" id="npCover" role="button" tabindex="0" aria-label="展开播放视图">
        ${song ? coverSvg(song.coverClass) : coverSvg('cover-a')}
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
        <div class="np-progress" id="progressBar">
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
        <div class="vol-track" id="volTrack"><div class="fill" style="width:${volPct}%"></div></div>
      </div>
    </div>
  </div>`;
}

function enableDrag(element, onValue) {
  if (!element) return;

  let dragging = false;

  function calcPct(e) {
    const rect = element.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  function start(e) {
    e.preventDefault();
    dragging = true;
    document.body.style.userSelect = 'none';
    onValue(calcPct(e));
  }

  function move(e) {
    if (!dragging) return;
    e.preventDefault();
    onValue(calcPct(e));
  }

  function end() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
  }

  element.addEventListener('mousedown', start);
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  element.addEventListener('touchstart', start, { passive: false });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end);
}

export function bind(root) {
  const bar = root.querySelector('#npBar') || root.querySelector('.np-bar');
  if (!bar) return;

  bar.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    togglePlay();
  });

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

  enableDrag(bar.querySelector('#progressBar'), pct => {
    setProgressByPointer({ offsetX: pct * (bar.querySelector('#progressBar')?.offsetWidth || 1) }, bar.querySelector('#progressBar'));
  });

  enableDrag(bar.querySelector('#volTrack'), pct => {
    setVolumeByPointer({ offsetX: pct * (bar.querySelector('#volTrack')?.offsetWidth || 1) }, bar.querySelector('#volTrack'));
  });
}
