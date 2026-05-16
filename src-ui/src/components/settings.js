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
    <div class="settings-page">
      <div class="settings-section">
        <h2>资料库</h2>
        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-info">
              <div class="settings-title">本地目录</div>
              <div class="settings-desc">正在管理的音乐文件夹</div>
            </div>
            <div class="settings-control">
              <button class="btn btn-ghost btn-sm" data-action="add-folder">添加目录</button>
            </div>
          </div>
          ${folders.length > 0 ? folders.map(f => `
            <div class="settings-row">
              <div class="settings-info">
                <div class="settings-title" style="font-family:var(--font-mono);font-size:12px;word-break:break-all;padding-right:12px;">${f.path}</div>
                <div class="settings-desc">${f.songCount} 首歌</div>
              </div>
              <div class="settings-control">
                <button class="extra-btn" data-action="remove-folder" data-path="${f.path}" aria-label="移除目录"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
          `).join('') : `
            <div class="settings-row">
              <div class="settings-desc" style="text-align:center;width:100%;">暂无管理的目录</div>
            </div>
          `}
        </div>
      </div>

      <div class="settings-section">
        <h2>外观</h2>
        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-info">
              <div class="settings-title">主题</div>
              <div class="settings-desc">选择应用的主题风格</div>
            </div>
            <div class="settings-control">
              <select class="settings-select" data-setting="theme">
                <option value="system">跟随系统</option>
                <option value="dark" selected>深色</option>
                <option value="light">浅色</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2>播放</h2>
        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-info">
              <div class="settings-title">淡入淡出 (Crossfade)</div>
              <div class="settings-desc">切换歌曲时平滑过渡</div>
            </div>
            <div class="settings-control">
              <label class="toggle-switch">
                <input type="checkbox" data-setting="crossfade" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h2>高级</h2>
        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-info">
              <div class="settings-title">硬件加速</div>
              <div class="settings-desc">使用 GPU 加速 UI 渲染</div>
            </div>
            <div class="settings-control">
              <label class="toggle-switch">
                <input type="checkbox" data-setting="hwaccel" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-info">
              <div class="settings-title">缓存限制</div>
              <div class="settings-desc">最大封面和歌词缓存</div>
            </div>
            <div class="settings-control">
              <select class="settings-select" data-setting="cache-size">
                <option value="128">128 MB</option>
                <option value="256" selected>256 MB</option>
                <option value="512">512 MB</option>
                <option value="1024">1 GB</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindPage(root) {
  createIcons({ icons });
  
  root.querySelectorAll('[data-action="remove-folder"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Mock remove action
      const path = btn.dataset.path;
      import('./toast.js').then(({ showToast }) => showToast(`目录 ${path} 已解除管理`, 'success'));
    });
  });
  
  root.querySelectorAll('[data-action="add-folder"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Trigger library scan
      const content = root.querySelector('.content');
      const importBtn = content?.querySelector('[aria-label="导入音乐"]');
      if (importBtn) importBtn.click();
    });
  });
}
