const state = {
  view: 'albums',
  viewMode: 'grid',
  sidebarActive: 'albums',
  searchQuery: '',
  sidebarCollapsed: false,
  sidebarWidth: 200,

  playing: { song: null, isPlaying: false, progress: 0.38, duration: 355 },
  queue: [],
  queueIndex: 0,
  loopMode: 'list',
  volume: 0.7,

  playlists: [
    { id: 'liked', name: '收藏', icon: 'heart', system: true },
    { id: 'recent', name: '最近播放', icon: 'clock', system: true },
    { id: 'pl-1', name: '深夜学习', icon: 'list-music', system: false },
    { id: 'pl-2', name: '晨间通勤', icon: 'list-music', system: false },
  ],
  likedIds: new Set(['s-1']),

  expanded: false,
  lyrics: false,
  mini: false,
  metadata: { open: false, song: null },
  contextMenu: { open: false, x: 0, y: 0, target: null },
};

const listeners = new Map();

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

export function setState(updates) {
  const changed = {};
  for (const [key, value] of Object.entries(updates)) {
    if (state[key] !== value) {
      state[key] = value;
      changed[key] = true;
    }
  }
  for (const key of Object.keys(changed)) {
    listeners.get(key)?.forEach(fn => fn(state[key], state));
  }
  listeners.get('*')?.forEach(fn => fn(state));
}

export function getState() { return state; }
