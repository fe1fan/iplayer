import { setState, getState } from '../state.js';
import { createPlaylist } from '../player-actions.js';

const COLLAPSED_W = 44;
const DEFAULT_W = 176;
const MIN_EXPAND = 128;
const MAX_W = 280;
const SNAP_DEAD_ZONE = 20;
const TRANSITION_MS = 280;

export function getSidebarWidth(state = getState()) {
  return state.sidebarCollapsed ? COLLAPSED_W : (state.sidebarWidth || DEFAULT_W);
}

function setShellWidth(appShell, width) {
  appShell?.style.setProperty('--sidebar-w-current', `${Math.round(width)}px`);
}

export function applySidebarLayout({ collapsed = getState().sidebarCollapsed, width = getSidebarWidth({ ...getState(), sidebarCollapsed: collapsed }) } = {}) {
  const appShell = document.querySelector('#appShell');
  const el = document.querySelector('.sidebar');
  if (!appShell || !el) return;

  setShellWidth(appShell, width);
  appShell.classList.toggle('sidebar-collapsed', collapsed);
  el.classList.toggle('collapsed', collapsed);
}

export function toggleSidebarCollapsed() {
  const s = getState();
  const collapsed = !s.sidebarCollapsed;
  const width = collapsed ? COLLAPSED_W : (s.sidebarWidth || DEFAULT_W);

  applySidebarLayout({ collapsed, width });
  setState({ sidebarCollapsed: collapsed });
}

export function render() {
  const s = getState();
  const collapsed = s.sidebarCollapsed;
  const navItems = [
    { key: 'songs', icon: 'music', label: '歌曲' },
    { key: 'albums', icon: 'disc-3', label: '专辑' },
    { key: 'artists', icon: 'mic-2', label: '艺术家' },
    { key: 'folders', icon: 'folder', label: '文件夹' },
    { key: 'plugins', icon: 'plug', label: '插件' },
  ];
  const plItems = s.playlists.map(pl => {
    const icon = pl.icon === 'heart' ? 'heart' : pl.icon === 'clock' ? 'clock' : 'list-music';
    const active = s.sidebarActive === `pl-${pl.id}` ? ' active' : '';
    return `<div class="sidebar-item${active}" role="button" tabindex="0" data-nav="pl-${pl.id}" aria-label="${pl.name}" title="${pl.name}">
      <i data-lucide="${icon}"></i><span class="sidebar-label">${pl.name}</span>
    </div>`;
  }).join('');

  return `
  <aside class="sidebar${collapsed ? ' collapsed' : ''}" role="navigation" aria-label="Main navigation">
    <div class="sidebar-section">
      <div class="sidebar-section-title">资料库</div>
      ${navItems.map(n => `
        <div class="sidebar-item${s.sidebarActive === n.key ? ' active' : ''}" role="button" tabindex="0" data-nav="${n.key}" aria-label="${n.label}" title="${n.label}">
          <i data-lucide="${n.icon}"></i><span class="sidebar-label">${n.label}</span>
        </div>
      `).join('')}
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">播放列表</div>
      ${plItems}
    </div>
    <div class="sidebar-footer">
      <button class="new-pl-btn" aria-label="新建播放列表">
        <i data-lucide="plus"></i> 新建播放列表
      </button>
    </div>
    <div class="sidebar-resizer" id="sidebarResizer"></div>
  </aside>`;
}

export function bind(root) {
  const el = root.querySelector('.sidebar');
  if (!el) return;

  el.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.dataset.nav;
      if (!nav) return;
      if (nav.startsWith('pl-')) {
        const playlistId = nav.slice(3);
        setState({ sidebarActive: nav, view: 'playlist', activePlaylistId: playlistId, searchQuery: '' });
        return;
      }
      setState({
        sidebarActive: nav,
        view: nav,
        activePlaylistId: null,
        searchQuery: '',
        selectedAlbumId: null,
        selectedArtist: null,
        selectedFolder: null,
      });
    });
    item.addEventListener('keydown', e => { if (e.key === 'Enter') item.click(); });
  });

  el.querySelector('.new-pl-btn')?.addEventListener('click', () => createPlaylist());

  const resizer = el.querySelector('#sidebarResizer');
  if (resizer) {
    let startX, startW, wasCollapsed, appShell;

    const setWidth = w => {
      if (appShell) setShellWidth(appShell, w);
    };

    const onMove = e => {
      const delta = e.clientX - startX;
      let rawW = wasCollapsed
        ? Math.max(COLLAPSED_W, Math.min(MAX_W, COLLAPSED_W + delta))
        : Math.max(COLLAPSED_W, Math.min(MAX_W, startW + delta));

      // In snap dead zone: don't move, stay at collapsed width
      if (rawW <= COLLAPSED_W + SNAP_DEAD_ZONE) {
        setWidth(COLLAPSED_W);
        return;
      }

      // Past dead zone: follow mouse, show full layout
      if (wasCollapsed) el.setAttribute('data-resizing', '');
      setWidth(rawW);
    };

    const finish = (collapsed, width) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Re-enable transitions
      if (appShell) appShell.style.transition = '';

      // Animate to target width after transition is restored.
      if (appShell) void appShell.offsetWidth;
      requestAnimationFrame(() => {
        applySidebarLayout({ collapsed, width });
      });

      // Keep persisted state in sync after the visible transition finishes.
      setTimeout(() => {
        el.removeAttribute('data-resizing');
        if (collapsed) {
          setState({ sidebarCollapsed: true });
        } else {
          setState({ sidebarCollapsed: false, sidebarWidth: width });
        }
      }, TRANSITION_MS);
    };

    const onUp = () => {
      const finalW = el.offsetWidth;

      if (!wasCollapsed) {
        if (finalW <= COLLAPSED_W + 1) {
          // Collapse
          finish(true, COLLAPSED_W);
        } else if (finalW < MIN_EXPAND) {
          // Too narrow — bounce back to saved width
          finish(false, getState().sidebarWidth || 200);
        } else {
          // Accept new width
          finish(false, finalW);
        }
      } else {
        if (finalW > COLLAPSED_W + SNAP_DEAD_ZONE) {
          // Expand
          finish(false, Math.max(MIN_EXPAND, finalW));
        } else {
          // Didn't pull enough — bounce back to collapsed
          finish(true, COLLAPSED_W);
        }
      }
    };

    resizer.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startW = el.offsetWidth;
      wasCollapsed = getState().sidebarCollapsed;
      appShell = el.closest('.app');
      // Disable transitions during drag
      if (appShell) appShell.style.transition = 'none';
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
