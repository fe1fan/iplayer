import { setState, getState } from '../state.js';
import { createIcons, icons } from 'lucide';

function getManagedFolders(s) {
  if (!s.librarySongs) return [];
  const map = new Map();
  s.librarySongs.forEach(song => {
    if (!song.filePath) return;
    const parts = song.filePath.split('/');
    if (parts.length < 2) return;
    const folderPath = parts.slice(0, -1).join('/');
    map.set(folderPath, (map.get(folderPath) || 0) + 1);
  });
  return Array.from(map.entries()).map(([path, songCount]) => ({ path, songCount }));
}

export function renderPage() {
  const s = getState();
  const folders = getManagedFolders(s);
  
  return `
    <div class="plugin-page" id="settingsPage">
      <section class="plugin-section plugin-hero">
        <div>
          <h2>设置</h2>
          <p>个性化你的播放器体验，管理本地音乐资料库及系统行为。</p>
        </div>
        <div class="plugin-stats">
          <span><strong>${folders.length}</strong> 资料库目录</span>
          <span><strong>${s.librarySongs?.length || 0}</strong> 首歌曲</span>
          <span><strong>v0.1.0</strong> 应用版本</span>
        </div>
      </section>

      <section class="plugin-section">
        <div class="plugin-section-head">
          <h4>资料库管理</h4>
          <button class="btn btn-primary btn-sm" data-action="add-folder"><i data-lucide="plus"></i> 添加目录</button>
        </div>
        <div class="plugin-list">
          ${folders.length > 0 ? folders.map(f => `
            <div class="plugin-row">
              <span class="plugin-status on"></span>
              <span class="plugin-row-main">
                <span class="plugin-name" style="font-family:var(--font-mono);font-size:11px;">${f.path}</span>
                <span class="plugin-source">${f.songCount} 首歌曲</span>
              </span>
              <button class="plugin-config-btn" style="background:rgba(220,38,38,0.1);color:#ef4444;" data-action="remove-folder" data-path="${f.path}">移除</button>
            </div>
          `).join('') : `
            <div style="padding:20px;text-align:center;color:var(--text-3);font-size:12px;">暂无管理的目录</div>
          `}
        </div>
      </section>

      <div class="plugin-page-layout">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <section class="plugin-section">
            <div class="plugin-section-head">
              <h4>外观</h4>
            </div>
            <div class="plugin-form">
              <label class="plugin-field">
                <span>主题风格</span>
                <select data-setting="theme">
                  <option value="system">跟随系统</option>
                  <option value="dark" selected>深色模式</option>
                  <option value="light">浅色模式</option>
                </select>
              </label>
              <label class="plugin-check">
                <input type="checkbox" checked>
                <span>毛玻璃特效 (Acrylic)</span>
              </label>
            </div>
          </section>

          <section class="plugin-section">
            <div class="plugin-section-head">
              <h4>播放行为</h4>
            </div>
            <div class="plugin-form">
              <label class="plugin-check">
                <input type="checkbox" data-setting="crossfade" checked>
                <span>启用淡入淡出 (Crossfade)</span>
              </label>
              <label class="plugin-field">
                <span>淡入淡出时长 (秒)</span>
                <input type="range" min="0" max="10" value="3">
              </label>
              <label class="plugin-check">
                <input type="checkbox" checked>
                <span>播放完毕后自动停止</span>
              </label>
            </div>
          </section>
        </div>

        <section class="plugin-section selected-plugin">
          <div class="plugin-section-head">
            <h4>高级选项</h4>
          </div>
          <div class="plugin-form" style="gap:15px;">
            <label class="plugin-check">
              <input type="checkbox" data-setting="hwaccel" checked>
              <span>硬件加速 (GPU)</span>
            </label>
            <label class="plugin-field">
              <span>缓存限制</span>
              <select data-setting="cache-size">
                <option value="128">128 MB</option>
                <option value="256" selected>256 MB</option>
                <option value="512">512 MB</option>
                <option value="1024">1 GB</option>
              </select>
            </label>
            <div style="margin-top:10px;">
              <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;border:1px solid var(--border);">清理缓存数据</button>
            </div>
          </div>
          <div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border);">
            <div class="plugin-meta-grid">
              <span>应用标识</span><strong>com.iplayer.app</strong>
              <span>数据目录</span><strong>~/Library/Application Support/...</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

export function bindPage(root) {
  createIcons({ icons });
  
  root.querySelectorAll('[data-action="remove-folder"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const path = btn.dataset.path;
      import('./toast.js').then(({ showToast }) => showToast(`目录 ${path} 已解除管理`, 'success'));
    });
  });
  
  root.querySelectorAll('[data-action="add-folder"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const content = document.querySelector('.content');
      const importBtn = content?.querySelector('[aria-label="导入音乐"]');
      if (importBtn) importBtn.click();
    });
  });
}
