import { subscribe, setState, getState } from './state.js';
import { songs, formatDuration, getProgressPercent } from './mock-data.js';
import { createIcons, icons } from 'lucide';
import { searchSongs } from './ipc.js';
import { showToast } from './components/toast.js';

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
  app.innerHTML = `
    ${titlebar.render()}
    <div class="app" id="appShell">
      ${sidebar.render()}
      ${content.render()}
      ${playerBar.render()}
    </div>
    ${nowPlaying.render()}
    ${lyrics.render()}
    ${metadataPanel.render()}
    ${miniMode.render()}
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
subscribe('volume', scheduleRender);
subscribe('contextMenu', scheduleRender);

subscribe('likedIds', () => {
  const s = getState();
  if (s.playing.song) {
    const isLiked = s.likedIds.has(s.playing.song.id);
    showToast(isLiked ? '已添加到收藏' : '已从收藏移除');
  }
});

subscribe('expanded', scheduleRender);
subscribe('lyrics', scheduleRender);
subscribe('mini', scheduleRender);
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
    const idx = songs.findIndex(song => song.id === s.playing.song.id);
    const next = (idx + 1) % songs.length;
    setState({ playing: { ...s.playing, song: songs[next], progress: 0, duration: songs[next].duration } });
  } else {
    s.playing.progress = progress;
    const fill = document.querySelector('#progressFill');
    if (fill) fill.style.width = (progress / s.playing.duration * 100) + '%';
  }
}, 1000);

// --- Init ---
setState({
  playing: {
    song: songs[0],
    isPlaying: false,
    progress: 0,
    duration: songs[0].duration,
  },
});

renderApp();
