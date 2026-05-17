import { getState, setState } from '../state.js';
import { toggleSidebarCollapsed } from './sidebar.js';
import { showToast } from './toast.js';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

function isMacOS() {
  const ua = navigator.userAgent || '';
  return /Mac|iPhone|iPad/.test(ua);
}

const SHOW_WINDOW_CONTROLS = isTauri() && !isMacOS();

export function render() {
  const s = getState();
  const controls = SHOW_WINDOW_CONTROLS ? `
    <div class="titlebar-controls">
      <button class="titlebar-btn" data-action="win-minimize" aria-label="最小化"><i data-lucide="minus"></i></button>
      <button class="titlebar-btn" data-action="win-maximize" aria-label="最大化"><i data-lucide="square"></i></button>
      <button class="titlebar-btn close" data-action="win-close" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>` : '';
  return `
  <div class="titlebar" id="titlebar">
    <div class="titlebar-traffic-lights" data-tauri-drag-region></div>
    <button class="titlebar-sidebar-toggle" data-action="toggle-sidebar" aria-label="切换侧边栏">
      <i data-lucide="sidebar"></i>
    </button>
    <span class="titlebar-title" data-tauri-drag-region>iPlayer</span>
    <div class="titlebar-drag" data-tauri-drag-region></div>
    <div class="titlebar-search">
      <i data-lucide="search"></i>
      <input type="text" id="searchInput" placeholder="搜索歌曲、艺术家…" aria-label="搜索" value="${s.searchQuery}">
    </div>
    ${controls}
  </div>`;
}

let maxIconState = null;
async function refreshMaximizedIcon() {
  if (!SHOW_WINDOW_CONTROLS) return;
  const btn = document.querySelector('[data-action="win-maximize"]');
  if (!btn) return;
  const win = getCurrentWindow();
  const maximized = await win.isMaximized().catch(() => false);
  document.body.classList.toggle('window-maximized', !!maximized);
  if (maximized === maxIconState) return;
  maxIconState = maximized;
  btn.setAttribute('aria-label', maximized ? '还原' : '最大化');
  const icon = btn.querySelector('i, svg');
  if (icon) {
    const next = document.createElement('i');
    next.setAttribute('data-lucide', maximized ? 'copy' : 'square');
    icon.replaceWith(next);
    const { createIcons, icons } = await import('lucide');
    createIcons({ icons, nameAttr: 'data-lucide' });
  }
}

let resizeListenerReady = false;
let searchCaret = null;
let searchHadFocus = false;

export function bind() {
  const el = document.querySelector('#titlebar');
  if (!el) return;

  el.querySelector('[data-action="toggle-sidebar"]')?.addEventListener('click', () => {
    toggleSidebarCollapsed();
  });

  if (SHOW_WINDOW_CONTROLS) {
    const win = getCurrentWindow();
    el.querySelector('[data-action="win-minimize"]')?.addEventListener('click', () => win.minimize());
    el.querySelector('[data-action="win-maximize"]')?.addEventListener('click', () => win.toggleMaximize());
    el.querySelector('[data-action="win-close"]')?.addEventListener('click', () => win.close());
    maxIconState = null;
    refreshMaximizedIcon();
    if (!resizeListenerReady) {
      resizeListenerReady = true;
      win.onResized(() => refreshMaximizedIcon());
    }
  }

  const searchInput = el.querySelector('#searchInput');
  if (searchInput) {
    let composing = false;
    let timer;

    function dispatchSearch() {
      const q = searchInput.value.trim();
      const s = getState();
      searchCaret = searchInput.selectionStart;
      const restoredView = s.sidebarActive?.startsWith('pl-') ? 'playlist' : (s.sidebarActive === 'albums' ? 'albums' : s.sidebarActive || 'songs');
      setState({
        searchQuery: q,
        view: q ? 'search' : restoredView,
        activePlaylistId: q ? null : s.activePlaylistId,
      });
    }

    searchInput.addEventListener('focus', () => { searchHadFocus = true; });
    searchInput.addEventListener('blur', () => { searchHadFocus = false; });
    searchInput.addEventListener('compositionstart', () => {
      composing = true;
      clearTimeout(timer);
    });
    searchInput.addEventListener('compositionend', () => {
      composing = false;
      clearTimeout(timer);
      timer = setTimeout(dispatchSearch, 200);
    });
    searchInput.addEventListener('input', () => {
      if (composing) return;
      clearTimeout(timer);
      timer = setTimeout(dispatchSearch, 200);
    });

    if (searchHadFocus) {
      searchInput.focus();
      const pos = searchCaret ?? searchInput.value.length;
      try { searchInput.setSelectionRange(pos, pos); } catch { /* ignore */ }
    }
  }
}
