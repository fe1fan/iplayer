import { setState, getState } from '../state.js';
import { songs as mockSongs } from '../mock-data.js';
import { updateMetadata } from '../ipc.js';
import { showToast } from './toast.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 140 140"><rect width="140" height="140" fill="${fill}"/></svg>`;
}

export function render() {
  const s = getState();
  const song = s.metadata.song;
  if (!song) return '';
  const openCls = s.metadata.open ? ' open' : '';

  return `
  <div class="meta-panel${openCls}" id="metaPanel" role="dialog" aria-label="元数据修复">
    <div class="panel-header">
      <h3>元数据修复</h3>
      <button data-action="close" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>
    <div class="panel-body">
      <div class="cover-edit ${song.coverClass}">
        ${coverSvg(song.coverClass)}
        <div class="cover-actions">
          <button data-action="cover-search" aria-label="搜索封面"><i data-lucide="search"></i> 搜索</button>
          <button data-action="cover-upload" aria-label="本地上传"><i data-lucide="upload"></i> 本地</button>
        </div>
      </div>
      <div class="field-group">
        <label for="metaTitle">标题</label>
        <input id="metaTitle" type="text" value="${song.title}">
      </div>
      <div class="field-group">
        <label for="metaArtist">艺术家</label>
        <input id="metaArtist" type="text" value="${song.artist}">
      </div>
      <div class="field-group">
        <label for="metaAlbum">专辑</label>
        <input id="metaAlbum" type="text" value="${song.album}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="field-group">
          <label for="metaYear">年份</label>
          <input id="metaYear" type="text" value="${song.year || ''}">
        </div>
        <div class="field-group">
          <label for="metaTrack">曲号</label>
          <input id="metaTrack" type="text" value="${song.track || ''}">
        </div>
      </div>
      <div class="field-group">
        <label>格式信息</label>
        <div class="format-info">${song.format || 'Unknown'}</div>
      </div>
      <button class="auto-match" data-action="auto-match" aria-label="从 MusicBrainz 自动匹配">
        <i data-lucide="database"></i> 从 MusicBrainz 自动匹配
      </button>
    </div>
    <div class="panel-footer">
      <button class="btn btn-ghost" data-action="cancel">取消</button>
      <button class="btn btn-primary" data-action="apply">应用修复</button>
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#metaPanel');
  if (!el) return;

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => closePanel());
  el.querySelector('[data-action="cancel"]')?.addEventListener('click', () => closePanel());
  el.querySelector('[data-action="cover-search"]')?.addEventListener('click', () => showToast('已模拟匹配 3 张候选封面'));
  el.querySelector('[data-action="cover-upload"]')?.addEventListener('click', () => showToast('本地封面上传入口已就绪'));
  el.querySelector('[data-action="auto-match"]')?.addEventListener('click', () => {
    const song = getState().metadata.song;
    if (!song) return;
    el.querySelector('#metaTitle').value = song.title.trim();
    el.querySelector('#metaArtist').value = song.artist.trim();
    el.querySelector('#metaAlbum').value = song.album.trim();
    el.querySelector('#metaYear').value = song.year || '';
    el.querySelector('#metaTrack').value = song.track || '';
    showToast('已填入模拟匹配结果');
  });
  el.querySelector('[data-action="apply"]')?.addEventListener('click', async () => {
    const s = getState();
    const song = s.metadata.song;
    if (song) {
      const patch = {
        title: el.querySelector('#metaTitle')?.value.trim() || song.title,
        artist: el.querySelector('#metaArtist')?.value.trim() || song.artist,
        album: el.querySelector('#metaAlbum')?.value.trim() || song.album,
        year: Number(el.querySelector('#metaYear')?.value) || song.year,
        track: el.querySelector('#metaTrack')?.value.trim() || song.track,
      };
      let next = { ...song, ...patch };
      try {
        const result = await updateMetadata(song.id, patch);
        next = result?.song || next;
      } catch (error) {
        console.warn('[ipc] update_metadata failed', error);
      }
      const currentSongs = getSongs();
      const target = currentSongs.find(item => item.id === song.id);
      if (target) Object.assign(target, next);
      if (s.librarySongs) {
        setState({
          librarySongs: s.librarySongs.map(item => item.id === song.id ? next : item),
        });
      }
      if (s.playing.song?.id === song.id) {
        setState({ playing: { ...s.playing, song: next } });
      }
    }
    closePanel();
    setState({ _toast: { msg: '元数据修复完成', type: 'success', ts: Date.now() } });
  });
}

function getSongs() {
  return getState().librarySongs || mockSongs;
}

function closePanel() {
  setState({ metadata: { open: false, song: null } });
}
