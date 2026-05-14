import { setState, getState } from '../state.js';
import { songs, albums, formatDuration } from '../mock-data.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 140 140"><rect width="140" height="140" fill="${fill}"/></svg>`;
}

function renderAlbumGrid() {
  return `<div class="album-grid">
    ${albums.map(a => `
      <div class="album-card" data-album-id="${a.id}" role="button" tabindex="0" aria-label="${a.title}">
        <div class="album-art ${a.coverClass}">
          ${coverSvg(a.coverClass)}
          <div class="play-overlay"><div class="play-btn-circle" data-play-album="${a.id}" aria-label="播放 ${a.title}"><i data-lucide="play"></i></div></div>
        </div>
        <div class="title">${a.title}</div>
        <div class="artist">${a.artist}</div>
      </div>
    `).join('')}
  </div>`;
}

function renderSongList(songList, playingId) {
  return `<table class="song-list" role="table">
    <thead><tr>
      <th scope="col">#</th><th scope="col">标题</th><th scope="col">艺术家</th><th scope="col">专辑</th><th scope="col">时长</th>
    </tr></thead>
    <tbody>
    ${songList.map((song, i) => {
      const isPlaying = song.id === playingId;
      return `<tr class="${isPlaying ? 'playing' : ''}" data-song-id="${song.id}">
        <td>${isPlaying ? '<div class="playing-icon"><span></span><span></span><span></span></div>' : `<span class="row-num">${i + 1}</span>`}</td>
        <td>${song.title}</td>
        <td>${song.artist}</td>
        <td>${song.album}</td>
        <td>${formatDuration(song.duration)}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

export function render() {
  const s = getState();
  const isAlbumView = s.view === 'albums';
  const isSearch = s.view === 'search';
  const title = isSearch ? `搜索 "${s.searchQuery}"` : isAlbumView ? '专辑' : '歌曲';
  const playingId = s.playing.song?.id;

  let body;
  if (isAlbumView) {
    body = renderAlbumGrid();
  } else {
    const list = isSearch ? (s._searchResults || []) : songs;
    if (list.length === 0 && isSearch) {
      body = `<div style="text-align:center;padding:80px 0;color:var(--text-3)">
        <i data-lucide="search" style="width:32px;height:32px;opacity:0.3"></i>
        <p style="margin-top:12px">未找到匹配的歌曲</p>
      </div>`;
    } else {
      body = renderSongList(list, playingId);
    }
  }

  return `
  <main class="content" id="contentArea" role="main">
    <div class="content-header">
      <h1>${title}</h1>
      <div class="actions">
        <div class="view-toggle">
          <button data-view="albums" class="${isAlbumView ? 'active' : ''}" aria-label="网格视图"><i data-lucide="grid-3x3"></i></button>
          <button data-view="songs" class="${!isAlbumView ? 'active' : ''}" aria-label="列表视图"><i data-lucide="list"></i></button>
        </div>
        <button class="btn btn-ghost" aria-label="导入音乐"><i data-lucide="plus-circle"></i> 导入</button>
      </div>
    </div>
    ${body}
  </main>`;
}

export function bind(root) {
  const el = root.querySelector('#contentArea') || root.querySelector('.content');
  if (!el) return;

  el.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      setState({ view: v, sidebarActive: v });
    });
  });

  el.querySelectorAll('tr[data-song-id]').forEach(tr => {
    tr.addEventListener('dblclick', () => playSong(tr.dataset.songId));
    tr.addEventListener('contextmenu', e => {
      e.preventDefault();
      setState({ contextMenu: { open: true, x: e.clientX, y: e.clientY, target: { type: 'song', id: tr.dataset.songId } } });
    });
  });

  el.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('dblclick', () => {
      const albumId = card.dataset.albumId;
      const albumSongs = songs.filter(s => s.albumId === albumId);
      if (albumSongs.length) playSong(albumSongs[0].id);
    });
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      setState({ contextMenu: { open: true, x: e.clientX, y: e.clientY, target: { type: 'album', id: card.dataset.albumId } } });
    });
  });

  el.querySelectorAll('[data-play-album]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const albumId = btn.dataset.playAlbum;
      const albumSongs = songs.filter(s => s.albumId === albumId);
      if (albumSongs.length) playSong(albumSongs[0].id);
    });
  });
}

function playSong(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;
  setState({ playing: { song, isPlaying: true, progress: 0, duration: song.duration } });
}
