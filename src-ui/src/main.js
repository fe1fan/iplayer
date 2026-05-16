import { subscribe, setState, getState } from './state.js';
import { songs, formatDuration, getProgressPercent } from './mock-data.js';
import { createIcons, icons } from 'lucide';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getLibrary, getPlaylists, searchSongs } from './ipc.js';
import { showToast } from './components/toast.js';
import { hydrateMiniStateIfNeeded, initWindowModeHandlers, shouldRenderMiniMode, syncMiniWindowMode } from './window-mode.js';
import { skipTrack } from './player-actions.js';

import * as sidebar from './components/sidebar.js';
import * as content from './components/content.js';
import * as playerBar from './components/player-bar.js';
import * as nowPlaying from './components/now-playing.js';
import * as lyrics from './components/lyrics.js';
import * as miniMode from './components/mini-mode.js';
import * as metadataPanel from './components/metadata-panel.js';
import * as contextMenu from './components/context-menu.js';
import * as titlebar from './components/titlebar.js';
import * as toast from './components/toast.js';

const app = document.querySelector('#app');
let renderPending = false;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  queueMicrotask(() => {
    renderPending = false;
    renderApp();
  });
}

function renderApp() {
  const s = getState();
  const sidebarWidth = sidebar.getSidebarWidth(s);
  app.innerHTML = `
    ${titlebar.render()}
    <div class="app${s.sidebarCollapsed ? ' sidebar-collapsed' : ''}" id="appShell" style="--sidebar-w-current:${sidebarWidth}px">
      ${sidebar.render()}
      ${content.render()}
      ${playerBar.render()}
    </div>
    ${nowPlaying.render()}
    ${lyrics.render()}
    ${metadataPanel.render()}
    ${shouldRenderMiniMode() ? miniMode.render() : ''}
    ${contextMenu.render()}
    ${toast.render()}
  `;
  createIcons({ icons });
  bindAll();
}

function bindAll() {
  titlebar.bind();
  sidebar.bind(app);
  content.bind(app);
  playerBar.bind(app);
  nowPlaying.bind(app);
  lyrics.bind(app);
  miniMode.bind(app);
  metadataPanel.bind(app);
  contextMenu.bind(app);
  toast.bind(app);
}

// --- State subscriptions ---

subscribe('view', scheduleRender);
subscribe('sidebarActive', scheduleRender);
subscribe('playing', scheduleRender);
subscribe('likedIds', scheduleRender);
subscribe('recentIds', scheduleRender);
subscribe('playlists', scheduleRender);
subscribe('activePlaylistId', scheduleRender);
subscribe('selectedAlbumId', scheduleRender);
subscribe('selectedArtist', scheduleRender);
subscribe('selectedFolder', scheduleRender);
subscribe('librarySongs', scheduleRender);
subscribe('libraryAlbums', scheduleRender);
subscribe('shuffle', scheduleRender);
subscribe('loopMode', scheduleRender);
subscribe('lyricsPanel', scheduleRender);
subscribe('pluginPanel', scheduleRender);
subscribe('pluginHooks', scheduleRender);
subscribe('plugins', scheduleRender);
subscribe('pluginSettings', scheduleRender);
subscribe('volume', scheduleRender);
subscribe('contextMenu', scheduleRender);

subscribe('expanded', scheduleRender);
subscribe('lyrics', scheduleRender);
subscribe('mini', enabled => {
  scheduleRender();
  syncMiniWindowMode(enabled);
});
subscribe('metadata', scheduleRender);

subscribe('searchQuery', async () => {
  const q = getState().searchQuery;
  if (q) {
    const results = await searchSongs(q);
    getState()._searchResults = results;
  } else {
    getState()._searchResults = null;
  }
  scheduleRender();
});

subscribe('_toast', () => {
  const s = getState();
  if (s._toast) showToast(s._toast.msg, s._toast.type);
});

// --- Global event listeners ---

document.addEventListener('click', e => {
  if (!e.target.closest('.ctx-menu') && getState().contextMenu.open) {
    setState({ contextMenu: { open: false, x: 0, y: 0, target: null } });
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const s = getState();
    if (s.contextMenu.open) setState({ contextMenu: { open: false, x: 0, y: 0, target: null } });
    else if (s.metadata.open) setState({ metadata: { open: false, song: null } });
    else if (s.lyrics) setState({ lyrics: false });
    else if (s.expanded) setState({ expanded: false });
    else if (s.mini) setState({ mini: false });
  }
  if (e.key === ' ' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    const s = getState();
    if (s.playing.song) setState({ playing: { ...s.playing, isPlaying: !s.playing.isPlaying } });
  }
});

// --- Playback progress simulation ---
setInterval(() => {
  const s = getState();
  if (!s.playing.isPlaying || !s.playing.song) return;
  const progress = s.playing.progress + 1;
  if (progress >= s.playing.duration) {
    if (s.loopMode === 'off') setState({ playing: { ...s.playing, progress: s.playing.duration, isPlaying: false } });
    else skipTrack(1);
  } else {
    s.playing.progress = progress;
    const pct = (progress / s.playing.duration * 100) + '%';
    document.querySelectorAll('[data-progress-fill]').forEach(fill => { fill.style.width = pct; });
    document.querySelectorAll('[data-current-time]').forEach(el => { el.textContent = formatDuration(progress); });
  }
}, 1000);

// --- Init ---
initWindowModeHandlers();

if (!hydrateMiniStateIfNeeded()) {
  setState({
    playing: {
      song: songs[0],
      isPlaying: false,
      progress: 0,
      duration: songs[0].duration,
    },
    queue: songs.map(song => song.id),
    queueIndex: 0,
  });
}

renderApp();

getLibrary().then(library => {
  if (!library?.songs?.length) return;
  const updates = {
    librarySongs: library.songs,
    libraryAlbums: library.albums || [],
  };
  const current = getState().playing.song;
  if (!current || !library.songs.some(song => song.id === current.id)) {
    updates.playing = {
      song: library.songs[0],
      isPlaying: false,
      progress: 0,
      duration: library.songs[0].duration,
    };
    updates.queue = library.songs.map(song => song.id);
    updates.queueIndex = 0;
  }
  setState(updates);
}).catch(error => {
  console.warn('[ipc] get_library failed', error);
});

getPlaylists().then(playlists => {
  if (!playlists?.length) return;
  const likedPlaylist = playlists.find(playlist => playlist.id === 'liked');
  setState({
    playlists,
    likedIds: new Set(likedPlaylist?.songIds || []),
  });
}).catch(error => {
  console.warn('[ipc] get_playlists failed', error);
});

if (isTauri()) {
  getCurrentWindow().listen('library:changed', event => {
    const data = event.payload;
    if (!data) return;
    setState({
      librarySongs: data.songs || getState().librarySongs,
      libraryAlbums: data.albums || getState().libraryAlbums,
    });
    showToast(`曲库已更新（${data.imported ?? 0} 首新增）`);
  });
}
