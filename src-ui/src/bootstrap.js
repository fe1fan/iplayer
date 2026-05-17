import { subscribe, getState, setState } from './state.js';
import { songs } from './mock-data.js';
import { getLibrary, getPlaylists, getPlugins, searchSongs } from './ipc.js';
import { showToast } from './components/toast.js';
import { hydrateMiniStateIfNeeded, initWindowModeHandlers } from './window-mode.js';

export function seedInitialState() {
  initWindowModeHandlers();

  if (!hydrateMiniStateIfNeeded()) {
    setState({
      playing: {
        song: songs[0],
        isPlaying: false,
        progress: 0,
        duration: songs[0].duration,
      },
      queue: songs.map(song => song.id),
      queueIndex: 0,
    });
  }
}

export function registerAsyncSubscriptions() {
  subscribe('searchQuery', async () => {
    const query = getState().searchQuery;
    if (query) {
      getState()._searchResults = await searchSongs(query);
    } else {
      getState()._searchResults = null;
    }
  });

  subscribe('_toast', () => {
    const t = getState()._toast;
    if (t) showToast(t.msg, t.type);
  });
}

export function startBootstrap() {
  loadLibrary();
  loadPlaylists();
  loadPlugins();
}

function loadLibrary() {
  getLibrary()
    .then(library => {
      if (!library?.songs?.length) return;
      const updates = {
        librarySongs: library.songs,
        libraryAlbums: library.albums || [],
      };
      const current = getState().playing.song;
      if (!current || !library.songs.some(song => song.id === current.id)) {
        updates.playing = {
          song: library.songs[0],
          isPlaying: false,
          progress: 0,
          duration: library.songs[0].duration,
        };
        updates.queue = library.songs.map(song => song.id);
        updates.queueIndex = 0;
      }
      setState(updates);
    })
    .catch(error => console.warn('[ipc] get_library failed', error));
}

function loadPlaylists() {
  getPlaylists()
    .then(playlists => {
      if (!playlists?.length) return;
      const likedPlaylist = playlists.find(playlist => playlist.id === 'liked');
      setState({
        playlists,
        likedIds: new Set(likedPlaylist?.songIds || []),
      });
    })
    .catch(error => console.warn('[ipc] get_playlists failed', error));
}

function loadPlugins() {
  getPlugins()
    .then(plugins => {
      if (!Array.isArray(plugins) || !plugins.length) return;
      const pluginSettings = {};
      for (const plugin of plugins) {
        if (plugin?.id && plugin.settings && typeof plugin.settings === 'object') {
          pluginSettings[plugin.id] = plugin.settings;
        }
      }
      setState({
        plugins,
        pluginSettings: { ...getState().pluginSettings, ...pluginSettings },
      });
    })
    .catch(error => console.warn('[ipc] get_plugins failed', error));
}
