import { getState, setState } from './state.js';

const CLOSE_CONTEXT_MENU = { contextMenu: { open: false, x: 0, y: 0, target: null } };

export function registerGlobalEvents() {
  document.addEventListener('click', event => {
    if (!event.target.closest('.ctx-menu') && getState().contextMenu.open) {
      setState(CLOSE_CONTEXT_MENU);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') handleEscape();
    if (event.key === ' ' && event.target.tagName !== 'INPUT') handleSpace(event);
  });
}

function handleEscape() {
  const s = getState();
  if (s.contextMenu.open) setState(CLOSE_CONTEXT_MENU);
  else if (s.metadata.open) setState({ metadata: { open: false, song: null } });
  else if (s.lyrics) setState({ lyrics: false });
  else if (s.expanded) setState({ expanded: false });
  else if (s.mini) setState({ mini: false });
}

function handleSpace(event) {
  event.preventDefault();
  const s = getState();
  if (s.playing.song) {
    setState({ playing: { ...s.playing, isPlaying: !s.playing.isPlaying } });
  }
}
