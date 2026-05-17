import { createIcons, icons } from 'lucide';
import { subscribe, getState, setState } from './state.js';
import { syncMiniWindowMode, shouldRenderMiniMode } from './window-mode.js';

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

const appEl = document.querySelector('#app');
let renderPending = false;
let renderSuppressed = false;

export function applyPlatformClass() {
  const ua = navigator.userAgent || '';
  let platform = 'linux';
  if (/Mac|iPhone|iPad/.test(ua)) platform = 'macos';
  else if (/Windows/.test(ua)) platform = 'windows';
  document.body.classList.add(`platform-${platform}`);
}

export function suppressRender(on) {
  renderSuppressed = on;
  if (!on) scheduleRender();
}

export function scheduleRender() {
  if (renderPending || renderSuppressed) return;
  renderPending = true;
  queueMicrotask(() => {
    renderPending = false;
    if (renderSuppressed) return;
    renderApp();
  });
}

export function renderApp() {
  const s = getState();
  const sidebarWidth = sidebar.getSidebarWidth(s);
  appEl.innerHTML = `
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
  sidebar.bind(appEl);
  content.bind(appEl);
  playerBar.bind(appEl);
  nowPlaying.bind(appEl);
  lyrics.bind(appEl);
  miniMode.bind(appEl);
  metadataPanel.bind(appEl);
  contextMenu.bind(appEl);
  toast.bind(appEl);
}

export function registerStateSubscriptions() {
  const rerender = [
    'view', 'sidebarActive', 'playing', 'likedIds', 'recentIds',
    'playlists', 'activePlaylistId', 'selectedAlbumId', 'selectedArtist',
    'selectedFolder', 'librarySongs', 'libraryAlbums', 'shuffle', 'loopMode',
    'lyricsPanel', 'pluginPanel', 'pluginHooks', 'plugins', 'pluginSettings',
    'volume', 'contextMenu', 'expanded', 'lyrics', 'metadata',
  ];
  for (const key of rerender) subscribe(key, scheduleRender);

  subscribe('mini', enabled => {
    scheduleRender();
    syncMiniWindowMode(enabled);
  });
}
