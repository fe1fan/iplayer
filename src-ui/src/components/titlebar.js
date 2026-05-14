import { getState } from '../state.js';

export function render() {
  return `
  <div class="titlebar" id="titlebar">
    <div class="titlebar-drag" data-tauri-drag-region></div>
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

  el.querySelector('[data-action="minimize"]')?.addEventListener('click', () => {
    if (window.__TAURI__) {
      window.__TAURI__.window.getCurrentWindow().minimize();
    }
  });

  el.querySelector('[data-action="maximize"]')?.addEventListener('click', () => {
    if (window.__TAURI__) {
      const win = window.__TAURI__.window.getCurrentWindow();
      win.isMaximized().then(maximized => {
        if (maximized) win.unmaximize();
        else win.maximize();
      });
    }
  });

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    if (window.__TAURI__) {
      window.__TAURI__.window.getCurrentWindow().close();
    }
  });
}
