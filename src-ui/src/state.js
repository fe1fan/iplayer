const state = {
  view: 'albums',
  viewMode: 'grid',
  sidebarActive: 'albums',
  searchQuery: '',
  sidebarCollapsed: false,
  sidebarWidth: 200,
  activePlaylistId: null,
  selectedAlbumId: null,
  selectedArtist: null,
  selectedFolder: null,

  playing: { song: null, isPlaying: false, progress: 0.38, duration: 355 },
  queue: [],
  queueIndex: 0,
  shuffle: false,
  loopMode: 'list',
  volume: 0.7,

  playlists: [
    { id: 'liked', name: '收藏', icon: 'heart', system: true, songIds: [] },
    { id: 'recent', name: '最近播放', icon: 'clock', system: true, songIds: [] },
    { id: 'pl-1', name: '深夜学习', icon: 'list-music', system: false, songIds: ['s-1', 's-4', 's-8', 's-10'] },
    { id: 'pl-2', name: '晨间通勤', icon: 'list-music', system: false, songIds: ['s-2', 's-6', 's-7', 's-12'] },
  ],
  likedIds: new Set(['s-1']),
  recentIds: [],

  expanded: false,
  lyrics: false,
  lyricsPanel: 'lyrics',
  mini: false,
  pluginPanel: { open: false, sourceType: 'local', sourceInput: '', selectedPluginId: 'plug-library-import' },
  pluginHooks: [
    { id: 'library:before-load', name: '加载音乐库前', description: '校验路径、补全扫描参数、接入远程库。', enabled: true },
    { id: 'library:after-load', name: '加载音乐库后', description: '重写标签、合并曲库、生成播放列表。', enabled: true },
    { id: 'playback:before-play', name: '播放音乐前', description: '按歌曲、设备或场景调整播放策略。', enabled: true },
    { id: 'audio:process-output', name: '音频输出处理', description: '调整音质、响度、均衡曲线和输出链路。', enabled: true },
    { id: 'metadata:resolve', name: '元数据匹配', description: '接入第三方标签、封面和识别服务。', enabled: false },
    { id: 'lyrics:resolve', name: '歌词解析', description: '接入在线歌词、翻译和逐字时间轴。', enabled: false },
  ],
  plugins: [
    {
      id: 'plug-library-import',
      name: 'Universal Library Loader',
      version: '0.3.0',
      source: 'local://plugins/library-loader',
      enabled: true,
      trust: 'local',
      hooks: ['library:before-load', 'library:after-load'],
      description: '从本地目录、挂载盘或远程清单汇入音乐库。',
    },
    {
      id: 'plug-audio-curve',
      name: 'Warm Output Curve',
      version: '1.1.2',
      source: 'npm:@iplayer/warm-output',
      enabled: true,
      trust: 'sandboxed',
      hooks: ['playback:before-play', 'audio:process-output'],
      description: '在播放前套用响度归一、柔和 EQ 与输出质量预设。',
    },
    {
      id: 'plug-lyrics-meta',
      name: 'Open Metadata Bridge',
      version: '0.8.4',
      source: 'https://plugins.example.com/open-metadata.json',
      enabled: false,
      trust: 'remote',
      hooks: ['metadata:resolve', 'lyrics:resolve'],
      description: '模拟接入第三方元数据与歌词提供方。',
    },
  ],
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
