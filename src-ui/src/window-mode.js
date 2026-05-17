import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getState, setState } from './state.js';

const MAIN_LABEL = 'main';
const MINI_LABEL = 'mini-player';
const MINI_W = 280;
const MINI_H = 80;
const SNAPSHOT_KEY = 'iplayer:mini-state';

let miniCloseHandlerReady = false;
let mainEventHandlersReady = false;
let closingMiniWindow = false;
let miniOpening = false;

export function isMiniWindow() {
  return new URLSearchParams(window.location.search).get('mini') === '1';
}

export function shouldRenderMiniMode() {
  return isMiniWindow() || !isTauri();
}

export function hydrateMiniStateIfNeeded() {
  if (!isMiniWindow()) return false;

  const snapshot = readSnapshot();
  if (snapshot) applySnapshot(snapshot, { mini: true });
  else setState({ mini: true, expanded: false, lyrics: false, metadata: { open: false, song: null } });
  return true;
}

export async function syncMiniWindowMode(enabled) {
  if (isMiniWindow()) {
    document.body.classList.add('mini-window');
    ensureMiniCloseHandler();
    if (!enabled) await restoreMainFromMini();
    return;
  }

  if (!enabled) {
    document.body.classList.remove('mini-window');
    return;
  }

  if (!isTauri()) {
    document.body.classList.add('mini-window');
    return;
  }

  await openMiniWindow();
}

export function initWindowModeHandlers() {
  if (!isTauri() || mainEventHandlersReady || isMiniWindow()) return;
  mainEventHandlersReady = true;
  const win = getCurrentWindow();

  win.listen('mini-window-state', event => {
    if (event.payload) applySnapshot(event.payload, { mini: false });
  });

  win.listen('mini-window-closed', event => {
    if (event.payload) applySnapshot(event.payload, { mini: false });
    else setState({ mini: false });
  });
}

async function openMiniWindow() {
  if (miniOpening) return;
  miniOpening = true;
  persistSnapshot();

  const main = getCurrentWindow();
  const existing = await WebviewWindow.getByLabel(MINI_LABEL);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    await main.hide();
    miniOpening = false;
    return;
  }

  const url = `${window.location.pathname || '/'}?mini=1`;
  const mini = new WebviewWindow(MINI_LABEL, {
    url,
    title: 'iPlayer Mini',
    width: MINI_W,
    height: MINI_H,
    minWidth: MINI_W,
    minHeight: MINI_H,
    maxWidth: MINI_W,
    maxHeight: MINI_H,
    resizable: false,
    decorations: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    shadow: true,
    skipTaskbar: true,
    focus: true,
    visible: true,
  });

  mini.once('tauri://created', async () => {
    await mini.setFocus();
    await mini.setBackgroundColor(null);
    await main.hide();
    miniOpening = false;
  });
  mini.once('tauri://error', error => {
    console.warn('Unable to create mini player window', error);
    document.body.classList.add('mini-window');
    miniOpening = false;
  });

  window.setTimeout(async () => {
    if (!miniOpening) return;
    await main.hide();
    miniOpening = false;
  }, 300);
}

async function restoreMainFromMini() {
  const snapshot = createSnapshot();

  if (!isTauri()) {
    document.body.classList.remove('mini-window');
    return;
  }

  const current = getCurrentWindow();
  const main = await WebviewWindow.getByLabel(MAIN_LABEL);

  await current.emitTo(MAIN_LABEL, 'mini-window-state', snapshot);
  if (main) {
    await main.show();
    await main.setFocus();
  }
  await current.emitTo(MAIN_LABEL, 'mini-window-closed', snapshot);
  closingMiniWindow = true;
  await current.destroy();
}

function ensureMiniCloseHandler() {
  if (!isTauri() || miniCloseHandlerReady) return;
  miniCloseHandlerReady = true;
  const win = getCurrentWindow();
  win.onCloseRequested(async event => {
    if (closingMiniWindow) return;
    event.preventDefault();
    await restoreMainFromMini();
  });
}

function createSnapshot(state = getState()) {
  return {
    playing: state.playing,
    volume: state.volume,
    likedIds: Array.from(state.likedIds),
    expanded: state.expanded,
    lyrics: state.lyrics,
  };
}

function persistSnapshot() {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(createSnapshot()));
}

function readSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applySnapshot(snapshot, extra = {}) {
  setState({
    playing: snapshot.playing || getState().playing,
    volume: typeof snapshot.volume === 'number' ? snapshot.volume : getState().volume,
    likedIds: new Set(snapshot.likedIds || []),
    expanded: Boolean(snapshot.expanded),
    lyrics: Boolean(snapshot.lyrics),
    metadata: { open: false, song: null },
    ...extra,
  });
}
