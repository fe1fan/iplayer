import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export function render() {
  return `
  <div class="titlebar" id="titlebar">
    <span class="titlebar-title">iplayer</span>
    <div class="titlebar-controls">
      <button class="titlebar-btn" data-action="minimize" aria-label="最小化">
        <i data-lucide="minus"></i>
      </button>
      <button class="titlebar-btn" data-action="maximize" aria-label="最大化">
        <i data-lucide="square"></i>
      </button>
      <button class="titlebar-btn close" data-action="close" aria-label="关闭">
        <i data-lucide="x"></i>
      </button>
    </div>
  </div>`;
}

export function bind() {
  const el = document.querySelector('#titlebar');
  if (!el) return;

  // Drag on mousedown anywhere on titlebar except buttons
  el.addEventListener('mousedown', e => {
    if (e.target.closest('.titlebar-btn')) return;
    appWindow.startDragging();
  });

  el.querySelector('[data-action="minimize"]')?.addEventListener('click', () => {
    appWindow.minimize();
  });

  el.querySelector('[data-action="maximize"]')?.addEventListener('click', async () => {
    const maximized = await appWindow.isMaximized();
    if (maximized) appWindow.unmaximize();
    else appWindow.maximize();
  });

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    appWindow.close();
  });
}
