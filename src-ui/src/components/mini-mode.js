import { setState, getState } from '../state.js';
import { songs } from '../mock-data.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 44 44"><rect width="44" height="44" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const song = s.playing.song;
  if (!song) return '';
  const playIcon = s.playing.isPlaying ? 'pause' : 'play';
  const playLabel = s.playing.isPlaying ? '暂停' : '播放';
  const isLiked = s.likedIds.has(song.id);

  const openCls = s.mini ? ' open' : '';

  return `
  <div class="mini-mode${openCls}" id="miniMode" role="dialog" aria-label="迷你播放器">
    <div class="mini-cover ${song.coverClass}" data-action="restore" role="button" tabindex="0" aria-label="恢复主窗口">
      ${coverSvg(song.coverClass)}
    </div>
    <div class="mini-info">
      <div class="title">${song.title}</div>
      <div class="artist">${song.artist}</div>
    </div>
    <div class="mini-controls">
      <button aria-label="上一首" data-action="prev"><i data-lucide="skip-back"></i></button>
      <button aria-label="${playLabel}" data-action="toggle-play"><i data-lucide="${playIcon}"></i></button>
      <button aria-label="下一首" data-action="next"><i data-lucide="skip-forward"></i></button>
      <button aria-label="${isLiked ? '已收藏' : '收藏'}" class="${isLiked ? 'liked' : ''}" data-action="like"><i data-lucide="heart"></i></button>
      <button aria-label="关闭迷你模式" data-action="close"><i data-lucide="x"></i></button>
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#miniMode');
  if (!el) return;

  el.querySelector('[data-action="restore"]')?.addEventListener('click', () => setState({ mini: false }));
  el.querySelector('[data-action="close"]')?.addEventListener('click', () => setState({ mini: false }));

  el.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    const s = getState();
    setState({ playing: { ...s.playing, isPlaying: !s.playing.isPlaying } });
  });

  el.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));

  el.querySelector('[data-action="like"]')?.addEventListener('click', () => {
    const s = getState();
    if (!s.playing.song) return;
    const newLiked = new Set(s.likedIds);
    if (newLiked.has(s.playing.song.id)) newLiked.delete(s.playing.song.id);
    else newLiked.add(s.playing.song.id);
    setState({ likedIds: newLiked });
  });
}

function skipTrack(dir) {
  const s = getState();
  if (!s.playing.song) return;
  const idx = songs.findIndex(song => song.id === s.playing.song.id);
  if (idx < 0) return;
  const next = (idx + dir + songs.length) % songs.length;
  setState({ playing: { ...s.playing, song: songs[next], progress: 0, duration: songs[next].duration } });
}
