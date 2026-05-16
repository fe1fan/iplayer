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
  librarySongs: null,
  libraryAlbums: null,

  playing: { song: null, isPlaying: false, progress: 0.38, duration: 355 },
  queue: [],
  queueIndex: 0,
  shuffle: false,
  loopMode: 'list',
  volume: 1.0,

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
  pluginPanel: { sourceType: 'local', sourceInput: '', selectedPluginId: 'plug-library-import', configPluginId: null },
  pluginHooks: [
    { id: 'app:init', group: 'system', name: '应用启动', description: '注册能力、迁移配置、检查插件兼容性。', enabled: true },
    { id: 'library:source-resolve', group: 'library', name: '曲库来源解析', description: '从本地、云盘、URL 或外部清单解析音乐来源。', enabled: true },
    { id: 'library:before-scan', group: 'library', name: '扫描曲库前', description: '校验路径、补全扫描参数、过滤目录。', enabled: true },
    { id: 'library:file-discovered', group: 'library', name: '发现音频文件', description: '过滤文件、修正路径、挂接远程资源。', enabled: true },
    { id: 'library:metadata-read', group: 'library', name: '读取本地标签后', description: '清洗标题、艺术家、专辑和曲号。', enabled: true },
    { id: 'library:after-load', group: 'library', name: '曲库加载完成', description: '合并曲库、生成索引、创建智能播放列表。', enabled: true },
    { id: 'metadata:resolve', group: 'enrichment', name: '在线元数据匹配', description: '接入第三方标签、专辑信息和发行信息服务。', enabled: false },
    { id: 'artwork:resolve', group: 'enrichment', name: '封面匹配', description: '搜索、替换、裁切或生成专辑封面。', enabled: false },
    { id: 'lyrics:resolve', group: 'enrichment', name: '歌词解析', description: '接入在线歌词、翻译和逐字时间轴。', enabled: false },
    { id: 'playlist:generate', group: 'enrichment', name: '播放列表生成', description: '基于标签、场景、情绪或规则生成列表。', enabled: true },
    { id: 'queue:before-change', group: 'playback', name: '播放队列变更前', description: '重排队列、插入推荐、过滤不可播放曲目。', enabled: true },
    { id: 'playback:before-play', group: 'playback', name: '播放音乐前', description: '按歌曲、设备或场景调整播放策略。', enabled: true },
    { id: 'decode:before', group: 'playback', name: '解码前', description: '选择解码器、读取增益、准备缓存。', enabled: false },
    { id: 'decode:after', group: 'audio', name: '解码后', description: '分析采样率、声道、响度和峰值。', enabled: false },
    { id: 'audio:process-output', group: 'audio', name: '音频处理链', description: '调整音质、响度、均衡曲线和输出链路。', enabled: true },
    { id: 'audio:before-device', group: 'audio', name: '输出设备前', description: '选择设备、应用独占模式或空间音频策略。', enabled: false },
    { id: 'playback:after-stop', group: 'integration', name: '播放停止后', description: '写入最近播放、恢复队列、触发统计。', enabled: true },
    { id: 'telemetry:scrobble', group: 'integration', name: '播放记录同步', description: '同步 Last.fm、ListenBrainz 或自建统计服务。', enabled: false },
    { id: 'ui:context-actions', group: 'ui', name: '界面动作扩展', description: '向右键菜单、歌曲详情和工具栏注入动作。', enabled: false },
    { id: 'ui:plugin-view', group: 'ui', name: '插件自定义页面', description: '允许插件提供独立配置页或工作台界面。', enabled: true },
  ],
  plugins: [
    {
      id: 'plug-library-import',
      name: 'Universal Library Loader',
      version: '0.3.0',
      source: 'local://plugins/library-loader',
      enabled: true,
      trust: 'local',
      hooks: ['library:source-resolve', 'library:before-scan', 'library:file-discovered', 'library:metadata-read', 'library:after-load', 'playlist:generate'],
      description: '从本地目录、挂载盘或远程清单汇入音乐库。',
      configType: 'library',
    },
    {
      id: 'plug-audio-curve',
      name: 'Warm Output Curve',
      version: '1.1.2',
      source: 'npm:@iplayer/warm-output',
      enabled: true,
      trust: 'sandboxed',
      hooks: ['playback:before-play', 'decode:after', 'audio:process-output', 'audio:before-device'],
      description: '在播放前套用响度归一、柔和 EQ 与输出质量预设。',
      configType: 'audio',
    },
    {
      id: 'plug-lyrics-meta',
      name: 'Open Metadata Bridge',
      version: '0.8.4',
      source: 'https://plugins.example.com/open-metadata.json',
      enabled: false,
      trust: 'remote',
      hooks: ['metadata:resolve', 'artwork:resolve', 'lyrics:resolve', 'telemetry:scrobble'],
      description: '模拟接入第三方元数据与歌词提供方。',
      configType: 'metadata',
    },
  ],
  pluginSettings: {
    'plug-library-import': { roots: '~/Music, /Volumes/Music', duplicateStrategy: 'prefer-lossless', autoPlaylist: true },
    'plug-audio-curve': { preset: 'warm', bass: 2, treble: -1, loudness: true },
    'plug-lyrics-meta': { provider: 'open-metadata', apiKey: '', translateLyrics: false },
  },
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
