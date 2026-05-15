import { setState, getState } from '../state.js';
import { songs, formatDuration, getProgressPercent } from '../mock-data.js';

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
        <button class="ctrl-btn" aria-label="随机播放"><i data-lucide="shuffle"></i></button>
        <button class="ctrl-btn" aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
        <button class="ctrl-btn play-main" id="playBtn" aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
        <button class="ctrl-btn" aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
        <button class="ctrl-btn" aria-label="循环"><i data-lucide="repeat"></i></button>
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

export function bind(root) {
  const bar = root.querySelector('#npBar') || root.querySelector('.np-bar');
  if (!bar) return;

  bar.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    const s = getState();
    if (!s.playing.song) {
      if (songs.length) setState({ playing: { ...s.playing, song: songs[0], isPlaying: true, duration: songs[0].duration, progress: 0 } });
      return;
    }
    setState({ playing: { ...s.playing, isPlaying: !s.playing.isPlaying } });
  });

  bar.querySelector('[data-action="prev"]')?.addEventListener('click', () => skip(-1));
  bar.querySelector('[data-action="next"]')?.addEventListener('click', () => skip(1));

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

  bar.querySelector('#progressBar')?.addEventListener('click', function(e) {
    const pct = e.offsetX / this.offsetWidth;
    const s = getState();
    if (s.playing.song) setState({ playing: { ...s.playing, progress: pct * s.playing.duration } });
  });

  bar.querySelector('#volTrack')?.addEventListener('click', function(e) {
    const pct = Math.max(0, Math.min(1, e.offsetX / this.offsetWidth));
    setState({ volume: pct });
  });
}

function skip(dir) {
  const s = getState();
  if (!s.playing.song) return;
  const idx = songs.findIndex(song => song.id === s.playing.song.id);
  if (idx < 0) return;
  const next = (idx + dir + songs.length) % songs.length;
  setState({ playing: { ...s.playing, song: songs[next], progress: 0, duration: songs[next].duration } });
}

function toggleLike() {
  const s = getState();
  if (!s.playing.song) return;
  const newLiked = new Set(s.likedIds);
  if (newLiked.has(s.playing.song.id)) newLiked.delete(s.playing.song.id);
  else newLiked.add(s.playing.song.id);
  setState({ likedIds: newLiked });
}
