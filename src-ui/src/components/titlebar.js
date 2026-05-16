import { getState, setState } from '../state.js';
import { toggleSidebarCollapsed } from './sidebar.js';
import { showToast } from './toast.js';

export function render() {
  const s = getState();
  return `
  <div class="titlebar" id="titlebar">
    <div class="titlebar-traffic-lights" data-tauri-drag-region></div>
    <button class="titlebar-sidebar-toggle" data-action="toggle-sidebar" aria-label="切换侧边栏">
      <i data-lucide="sidebar"></i>
    </button>
    <span class="titlebar-title">iPlayer</span>
    <div class="titlebar-drag" data-tauri-drag-region></div>
    <div class="titlebar-search">
      <i data-lucide="search"></i>
      <input type="text" id="searchInput" placeholder="搜索歌曲、艺术家…" aria-label="搜索" value="${s.searchQuery}">
    </div>
  </div>`;
}

export function bind() {
  const el = document.querySelector('#titlebar');
  if (!el) return;

  el.querySelector('[data-action="toggle-sidebar"]')?.addEventListener('click', () => {
    toggleSidebarCollapsed();
  });

  const searchInput = el.querySelector('#searchInput');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = searchInput.value.trim();
        const s = getState();
        const restoredView = s.sidebarActive?.startsWith('pl-') ? 'playlist' : (s.sidebarActive === 'albums' ? 'albums' : s.sidebarActive || 'songs');
        setState({
          searchQuery: q,
          view: q ? 'search' : restoredView,
          activePlaylistId: q ? null : s.activePlaylistId,
        });
      }, 200);
    });
  }
}
