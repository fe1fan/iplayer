import { setState, getState } from '../state.js';
import { songs as mockSongs, albums as mockAlbums, folders as mockFolders, formatDuration } from '../mock-data.js';
import { describeIpcError, getPlaylists, pickAndScanLibrary } from '../ipc.js';
import { playSong, playSongList } from '../player-actions.js';
import { showToast } from './toast.js';
import * as pluginPage from './plugin-panel.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 140 140"><rect width="140" height="140" fill="${fill}"/></svg>`;
}

function renderAlbumGrid() {
  const albums = getAlbums();
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

function renderEntityGrid(items, type) {
  const icon = type === 'artist' ? 'mic-2' : 'folder';
  return `<div class="entity-grid">
    ${items.map(item => `
      <button class="entity-card" data-${type}-id="${item.id}">
        <span class="entity-icon"><i data-lucide="${icon}"></i></span>
        <span class="entity-main">${item.name}</span>
        <span class="entity-meta">${type === 'artist' ? `${item.albumCount} 张专辑 · ${item.songCount} 首歌` : `${item.songIds.length} 首歌`}</span>
      </button>
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
      return `<tr class="${isPlaying ? 'playing' : ''}" data-song-id="${song.id}" tabindex="0">
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
  const songs = getSongs();
  const albums = getAlbums();
  const folders = getFolders();
  const isAlbumView = s.view === 'albums';
  const isSearch = s.view === 'search';
  const activePlaylist = s.playlists.find(pl => pl.id === s.activePlaylistId);
  const selectedAlbum = albums.find(album => album.id === s.selectedAlbumId);
  const selectedFolder = folders.find(folder => folder.id === s.selectedFolder);
  const titleMap = {
    albums: '专辑',
    songs: '歌曲',
    artists: '艺术家',
    folders: '文件夹',
    playlist: activePlaylist?.name || '播放列表',
    album: selectedAlbum?.title || '专辑',
    artist: s.selectedArtist || '艺术家',
    folder: selectedFolder?.name || '文件夹',
    plugins: '插件',
    'plugin-config': '插件配置',
  };
  const title = isSearch ? `搜索 "${s.searchQuery}"` : (titleMap[s.view] || '歌曲');
  const playingId = s.playing.song?.id;

  let body;
  if (s.view === 'plugins' || s.view === 'plugin-config') {
    body = pluginPage.renderPage();
  } else if (s.view === 'albums') {
    body = renderAlbumGrid();
  } else if (s.view === 'artists') {
    body = renderEntityGrid(getArtists(songs), 'artist');
  } else if (s.view === 'folders') {
    body = renderEntityGrid(folders, 'folder');
  } else {
    let list = songs;
    if (isSearch) list = s._searchResults || [];
    if (s.view === 'playlist') {
      if (s.activePlaylistId === 'liked') list = songs.filter(song => s.likedIds.has(song.id));
      else if (s.activePlaylistId === 'recent') list = s.recentIds.map(id => songs.find(song => song.id === id)).filter(Boolean);
      else list = songs.filter(song => activePlaylist?.songIds?.includes(song.id));
    }
    if (s.view === 'album') list = songs.filter(song => song.albumId === s.selectedAlbumId);
    if (s.view === 'artist') list = songs.filter(song => song.artist === s.selectedArtist);
    if (s.view === 'folder') list = songs.filter(song => selectedFolder?.songIds.includes(song.id));

    if (list.length === 0 && isSearch) {
      body = `<div class="empty-state">
        <i data-lucide="search" style="width:32px;height:32px;opacity:0.3"></i>
        <p style="margin-top:12px">未找到匹配的歌曲</p>
      </div>`;
    } else if (list.length === 0) {
      body = `<div class="empty-state">
        <i data-lucide="music" style="width:32px;height:32px;opacity:0.3"></i>
        <p style="margin-top:12px">这里还没有歌曲</p>
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
        ${s.view === 'plugins' || s.view === 'plugin-config' ? '' : `<div class="view-toggle">
          <button data-view="albums" class="${isAlbumView ? 'active' : ''}" aria-label="网格视图"><i data-lucide="grid-3x3"></i></button>
          <button data-view="songs" class="${!isAlbumView ? 'active' : ''}" aria-label="列表视图"><i data-lucide="list"></i></button>
        </div>
        <button class="btn btn-ghost" aria-label="导入音乐"><i data-lucide="plus-circle"></i> 导入</button>`}
      </div>
    </div>
    <div class="content-body">${body}</div>
  </main>`;
}

export function bind(root) {
  const el = root.querySelector('#contentArea') || root.querySelector('.content');
  if (!el) return;

  if (getState().view === 'plugins' || getState().view === 'plugin-config') {
    pluginPage.bindPage(el);
    return;
  }

  const songs = getSongs();

  el.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      setState({ view: v, sidebarActive: v });
    });
  });

  el.querySelector('[aria-label="导入音乐"]')?.addEventListener('click', async () => {
    try {
      const result = await pickAndScanLibrary();
      if (!result) return;
      const playlists = await getPlaylists();
      const likedPlaylist = playlists.find(playlist => playlist.id === 'liked');
      const updates = {
        librarySongs: result.songs || [],
        libraryAlbums: result.albums || [],
        view: 'songs',
        sidebarActive: 'songs',
      };
      if (playlists.length) {
        updates.playlists = playlists;
        updates.likedIds = new Set(likedPlaylist?.songIds || []);
      }
      setState(updates);
      showToast(`已导入 ${result.imported ?? result.total ?? 0} 首歌曲`);
    } catch (error) {
      console.warn('[ipc] scan_library failed', error);
      showToast(`导入失败：${describeIpcError(error)}`, 'error');
    }
  });

  el.querySelectorAll('tr[data-song-id]').forEach(tr => {
    tr.addEventListener('click', () => setState({ selectedSongId: tr.dataset.songId }));
    tr.addEventListener('dblclick', () => playSong(tr.dataset.songId, currentList()));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') playSong(tr.dataset.songId, currentList()); });
    tr.addEventListener('contextmenu', e => {
      e.preventDefault();
      setState({ contextMenu: { open: true, x: e.clientX, y: e.clientY, target: { type: 'song', id: tr.dataset.songId } } });
    });
  });

  el.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-play-album]')) return;
      setState({ view: 'album', sidebarActive: 'albums', selectedAlbumId: card.dataset.albumId });
    });
    card.addEventListener('dblclick', () => {
      const albumId = card.dataset.albumId;
      const albumSongs = songs.filter(s => s.albumId === albumId);
      if (albumSongs.length) playSongList(albumSongs, albumSongs[0].id);
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
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
      if (albumSongs.length) playSongList(albumSongs, albumSongs[0].id);
    });
  });

  el.querySelectorAll('[data-artist-id]').forEach(card => {
    card.addEventListener('click', () => {
      setState({ view: 'artist', sidebarActive: 'artists', selectedArtist: card.dataset.artistId });
    });
  });

  el.querySelectorAll('[data-folder-id]').forEach(card => {
    card.addEventListener('click', () => {
      setState({ view: 'folder', sidebarActive: 'folders', selectedFolder: card.dataset.folderId });
    });
  });
}

function currentList() {
  const s = getState();
  const songs = getSongs();
  const folders = getFolders();
  const activePlaylist = s.playlists.find(pl => pl.id === s.activePlaylistId);
  if (s.view === 'search') return s._searchResults || [];
  if (s.view === 'playlist') {
    if (s.activePlaylistId === 'liked') return songs.filter(song => s.likedIds.has(song.id));
    if (s.activePlaylistId === 'recent') return s.recentIds.map(id => songs.find(song => song.id === id)).filter(Boolean);
    return songs.filter(song => activePlaylist?.songIds?.includes(song.id));
  }
  if (s.view === 'album') return songs.filter(song => song.albumId === s.selectedAlbumId);
  if (s.view === 'artist') return songs.filter(song => song.artist === s.selectedArtist);
  if (s.view === 'folder') {
    const folder = folders.find(item => item.id === s.selectedFolder);
    return songs.filter(song => folder?.songIds.includes(song.id));
  }
  return songs;
}

function getSongs() {
  return getState().librarySongs || mockSongs;
}

function getAlbums() {
  return getState().libraryAlbums || mockAlbums;
}

function getFolders() {
  const songs = getSongs();
  if (!getState().librarySongs) return mockFolders;

  const folders = new Map();
  songs.forEach(song => {
    if (!song.folderId) return;
    const current = folders.get(song.folderId) || {
      id: song.folderId,
      name: folderName(song.filePath, song.folderId),
      songIds: [],
    };
    current.songIds.push(song.id);
    folders.set(song.folderId, current);
  });
  return Array.from(folders.values());
}

function getArtists(songs) {
  return Array.from(songs.reduce((map, song) => {
    const current = map.get(song.artist) || { id: song.artist, name: song.artist, songCount: 0, albumIds: new Set() };
    current.songCount += 1;
    current.albumIds.add(song.albumId);
    map.set(song.artist, current);
    return map;
  }, new Map()).values()).map(artist => ({
    id: artist.id,
    name: artist.name,
    songCount: artist.songCount,
    albumCount: artist.albumIds.size,
  }));
}

function folderName(filePath, fallback) {
  if (!filePath) return fallback;
  const parts = filePath.split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : fallback;
}
