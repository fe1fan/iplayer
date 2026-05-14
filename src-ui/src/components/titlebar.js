import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export function render() {
  return `
  <div class="titlebar" id="titlebar" data-tauri-drag-region>
    <span class="titlebar-title" data-tauri-drag-region>iplayer</span>
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

  // Prevent drag on buttons
  el.querySelectorAll('.titlebar-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => e.stopPropagation());
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
