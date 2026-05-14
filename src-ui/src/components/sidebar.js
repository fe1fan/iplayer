import { setState, getState } from '../state.js';

export function render() {
  const s = getState();
  const navItems = [
    { key: 'songs', icon: 'music', label: '歌曲' },
    { key: 'albums', icon: 'disc-3', label: '专辑' },
    { key: 'artists', icon: 'mic-2', label: '艺术家' },
    { key: 'folders', icon: 'folder', label: '文件夹' },
  ];
  const plItems = s.playlists.map(pl => {
    const icon = pl.icon === 'heart' ? 'heart' : pl.icon === 'clock' ? 'clock' : 'list-music';
    return `<div class="sidebar-item" role="button" tabindex="0" data-nav="pl-${pl.id}" aria-label="${pl.name}">
      <i data-lucide="${icon}"></i> ${pl.name}
    </div>`;
  }).join('');

  return `
  <aside class="sidebar" role="navigation" aria-label="Main navigation">
    <div class="sidebar-brand">
      <div class="logo" aria-hidden="true">i</div>
      <span>iplayer</span>
    </div>
    <div class="sidebar-search">
      <i data-lucide="search" class="search-icon"></i>
      <input type="text" id="searchInput" placeholder="搜索歌曲、艺术家…" aria-label="搜索" value="${s.searchQuery}">
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">资料库</div>
      ${navItems.map(n => `
        <div class="sidebar-item${s.sidebarActive === n.key ? ' active' : ''}" role="button" tabindex="0" data-nav="${n.key}" aria-label="${n.label}">
          <i data-lucide="${n.icon}"></i> ${n.label}
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
  </aside>`;
}

export function bind(root) {
  const el = root.querySelector('.sidebar');
  if (!el) return;

  el.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.dataset.nav;
      if (!nav || nav.startsWith('pl-')) return;
      setState({ sidebarActive: nav, view: nav === 'albums' ? 'albums' : 'songs' });
    });
    item.addEventListener('keydown', e => { if (e.key === 'Enter') item.click(); });
  });

  const searchInput = el.querySelector('#searchInput');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = searchInput.value.trim();
        setState({ searchQuery: q, view: q ? 'search' : (getState().sidebarActive === 'albums' ? 'albums' : 'songs') });
      }, 200);
    });
  }
}
