import { createIcons, icons } from 'lucide';

export function render() {
  return `<div class="toast-container" id="toastContainer" aria-live="polite"></div>`;
}

export function bind() {
  // Toast is managed imperatively via showToast()
}

export function showToast(msg, type = 'success') {
  const container = document.querySelector('#toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${iconName}"></i> ${msg}`;
  container.appendChild(toast);
  createIcons({ icons });

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 160);
  }, 3000);
}
