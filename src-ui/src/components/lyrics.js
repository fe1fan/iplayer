import { setState, getState } from '../state.js';
import { lyricsData, getProgressPercent, formatDuration } from '../mock-data.js';
import { getQueueSongs, playSong, setProgressByPointer, skipTrack, togglePlay } from '../player-actions.js';
import { showToast } from './toast.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 28 28"><rect width="28" height="28" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const song = s.playing.song;
  if (!song) return '';
  const lines = lyricsData[song.id];
  const playIcon = s.playing.isPlaying ? 'pause' : 'play';
  const playLabel = s.playing.isPlaying ? '暂停' : '播放';
  const pct = getProgressPercent(s) * 100;
  const currentLine = lines ? Math.floor((pct / 100) * lines.length) : 0;
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
  } else if (!lines || lines.length === 0) {
    bodyContent = `
    <div class="lyrics-body">
      <div class="lyrics-empty">
        <i data-lucide="text"></i>
        <p>暂无歌词</p>
        <button data-action="search-lyrics">搜索在线歌词</button>
      </div>
    </div>`;
  } else {
    bodyContent = `
    <div class="lyrics-body" id="lyricsBody">
      ${lines.map((line, i) => {
        let cls = 'lyric-line';
        if (i < currentLine) cls += ' past';
        else if (i === currentLine) cls += ' current';
        return `<div class="${cls}">${line || '&nbsp;'}</div>`;
      }).join('')}
    </div>`;
  }

  return `
  <div class="overlay lyrics-view${openCls}" id="lyricsView" role="dialog" aria-label="歌词" aria-modal="true">
    <div class="lyrics-header">
      <div class="track-info">
        <div class="thumb ${song.coverClass}">${coverSvg(song.coverClass)}</div>
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
  el.querySelector('[data-action="search-lyrics"]')?.addEventListener('click', () => {
    const s = getState();
    if (!s.playing.song) return;
    lyricsData[s.playing.song.id] = [
      '已找到模拟歌词',
      s.playing.song.title,
      '这一行会跟随进度高亮',
      '真实歌词服务后续接入',
    ];
    setState({ lyricsPanel: 'lyrics' });
    showToast('已模拟获取在线歌词');
  });

  el.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
    togglePlay();
  });

  el.querySelector('[data-action="prev"]')?.addEventListener('click', () => skipTrack(-1));
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => skipTrack(1));

  el.querySelector('#lyricsProg')?.addEventListener('click', function(e) {
    setProgressByPointer(e, this);
  });

  el.querySelectorAll('.queue-row[data-song-id]').forEach(row => {
    row.addEventListener('click', () => playSong(row.dataset.songId, getQueueSongs()));
  });
}
