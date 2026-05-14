import { setState, getState } from '../state.js';

function coverSvg(cls) {
  const fill = cls === 'cover-a' ? '#DBEAFE' : '#DCFCE7';
  return `<svg viewBox="0 0 180 180"><rect width="180" height="180" fill="${fill}"/></svg>`;
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
          <button aria-label="搜索封面"><i data-lucide="search"></i> 搜索</button>
          <button aria-label="本地上传"><i data-lucide="upload"></i> 本地</button>
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
      <button class="auto-match" aria-label="从 MusicBrainz 自动匹配">
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
  el.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    closePanel();
    setState({ _toast: { msg: '元数据修复完成', type: 'success', ts: Date.now() } });
  });
}

function closePanel() {
  setState({ metadata: { open: false, song: null } });
}
