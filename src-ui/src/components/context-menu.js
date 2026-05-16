import { setState, getState } from '../state.js';
import { songs as mockSongs } from '../mock-data.js';
import { addSongsToPlaylist, addToPlaylist, createPlaylist, deletePlaylist, playSong, playSongList, renamePlaylist, removeSongFromPlaylist } from '../player-actions.js';
import { showToast } from './toast.js';

const menuItems = [
  { icon: 'play', label: '播放', action: 'play' },
  { icon: 'list-plus', label: '添加到播放列表', action: 'add-to-list' },
  { icon: 'disc-3', label: '查看专辑', action: 'view-album' },
  { icon: 'pencil', label: '修复元数据', action: 'edit-meta' },
  { divider: true },
  { icon: 'folder-open', label: '在文件夹中显示', action: 'show-in-folder' },
];

export function render() {
  const s = getState();
  const items = getMenuItems(s.contextMenu.target);

  return `
  <div class="ctx-menu${s.contextMenu.open ? ' open' : ''}" id="ctxMenu" role="menu"
       style="left:${s.contextMenu.x}px;top:${s.contextMenu.y}px">
    ${items.map(item => {
      if (item.divider) return '<div class="ctx-divider"></div>';
      return `<button role="menuitem" data-action="${item.action}"><i data-lucide="${item.icon}"></i> ${item.label}</button>`;
    }).join('')}
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#ctxMenu');
  if (!el) return;

  el.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const s = getState();
      const songs = getSongs();
      const target = s.contextMenu.target;
      hide();

      if (!target) return;

      switch (action) {
        case 'new-playlist':
          await createPlaylist();
          break;
        case 'play':
          if (target.type === 'song') {
            playSong(target.id, songs);
          } else if (target.type === 'album') {
            const albumSongs = songs.filter(song => song.albumId === target.id);
            playSongList(albumSongs, albumSongs[0]?.id);
          }
          break;
        case 'add-to-list':
          if (target.type === 'song') await addToPlaylist(target.id);
          else if (target.type === 'album') {
            await addSongsToPlaylist(songs.filter(song => song.albumId === target.id).map(song => song.id));
          }
          break;
        case 'view-album':
          if (target.type === 'song') {
            const song = songs.find(s => s.id === target.id);
            if (song) setState({ view: 'album', sidebarActive: 'albums', selectedAlbumId: song.albumId });
          } else if (target.type === 'album') {
            setState({ view: 'album', sidebarActive: 'albums', selectedAlbumId: target.id });
          }
          break;
        case 'edit-meta':
          if (target.type === 'song') {
            const song = songs.find(s => s.id === target.id);
            if (song) setState({ metadata: { open: true, song } });
          } else if (target.type === 'album') {
            const song = songs.find(s => s.albumId === target.id);
            if (song) setState({ metadata: { open: true, song } });
          }
          break;
        case 'show-in-folder':
          showToast('已模拟打开所在文件夹');
          break;
        case 'rename-playlist':
          if (target.type === 'playlist') {
            const name = window.prompt('重命名播放列表', getState().playlists.find(p => p.id === target.id)?.name || '');
            if (name?.trim()) await renamePlaylist(target.id, name.trim());
          }
          break;
        case 'delete-playlist':
          if (target.type === 'playlist') {
            if (window.confirm(`确定删除「${getState().playlists.find(p => p.id === target.id)?.name || ''}」？`)) {
              await deletePlaylist(target.id);
            }
          }
          break;
        case 'remove-from-playlist':
          if (target.playlistId && target.id) {
            await removeSongFromPlaylist(target.playlistId, target.id);
          }
          break;
      }
    });
  });
}

function getSongs() {
  return getState().librarySongs || mockSongs;
}

function hide() {
  setState({ contextMenu: { open: false, x: 0, y: 0, target: null } });
}

function getMenuItems(target) {
  if (target?.type === 'playlists') {
    return [
      { icon: 'plus', label: '新建播放列表', action: 'new-playlist' },
    ];
  }
  if (target?.type === 'playlist') {
    const items = [
      { icon: 'pencil', label: '重命名', action: 'rename-playlist' },
    ];
    if (!target.system) {
      items.push({ icon: 'trash-2', label: '删除', action: 'delete-playlist' });
    }
    return items;
  }
  const items = [...menuItems];
  if (target?.type === 'song' && target.playlistId) {
    items.push(
      { divider: true },
      { icon: 'x', label: '从播放列表移除', action: 'remove-from-playlist' },
    );
  }
  return items;
}
