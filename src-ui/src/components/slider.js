import { suppressRender } from '../main.js';

export function attachSlider(track, fill, { onPreview, onCommit }) {
  if (!track || !fill) return;

  let dragging = false;

  function pctFromEvent(e) {
    const rect = track.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const pct = pctFromEvent(e);
    fill.style.width = (pct * 100) + '%';
    onPreview?.(pct);
  }

  function onEnd(e) {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.body.style.userSelect = '';
    suppressRender(false);
    const pct = pctFromEvent(e);
    onCommit(pct);
  }

  function onStart(e) {
    e.preventDefault();
    dragging = true;
    suppressRender(true);
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    const pct = pctFromEvent(e);
    fill.style.width = (pct * 100) + '%';
    onPreview?.(pct);
  }

  track.addEventListener('mousedown', onStart);
  track.addEventListener('touchstart', onStart, { passive: false });
}
