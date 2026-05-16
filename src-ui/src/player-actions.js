import { getState, setState } from './state.js';
import { songs } from './mock-data.js';
import { isTauri } from '@tauri-apps/api/core';
import { addSongsToPlaylist as ipcAddSongsToPlaylist, createPlaylist as ipcCreatePlaylist, deletePlaylist as ipcDeletePlaylist, getPlaylists, ipcPause, ipcPlaySong, ipcResume, ipcSeek, ipcSetLoopMode, ipcSetVolume, ipcSkipTrack, ipcStop, removeSongFromPlaylist as ipcRemoveSongFromPlaylist, renamePlaylist as ipcRenamePlaylist, toggleLike as ipcToggleLike } from './ipc.js';
import { showToast } from './components/toast.js';

function librarySongs(state = getState()) {
  return state.librarySongs || songs;
}

export function getSongById(songId) {
  return librarySongs().find(song => song.id === songId) || null;
}

export function getQueueSongs(state = getState()) {
  const allSongs = librarySongs(state);
  const queue = state.queue?.length ? state.queue : allSongs.map(song => song.id);
  return queue.map(getSongById).filter(Boolean);
}

export function playSong(songId, queueSongs = librarySongs()) {
  const song = getSongById(songId);
  if (!song) return;

  const allSongs = librarySongs();
  const queue = queueSongs.length ? queueSongs.map(item => item.id) : allSongs.map(item => item.id);
  const queueIndex = Math.max(0, queue.indexOf(song.id));
  const recentIds = [song.id, ...getState().recentIds.filter(id => id !== song.id)].slice(0, 20);

  setState({
    playing: { song, isPlaying: true, progress: 0, duration: song.duration },
    queue,
    queueIndex,
    recentIds,
  });

  if (isTauri()) {
    ipcPlaySong(songId, queue, queueIndex).catch(err => console.warn('[ipc] play_song failed', err));
  }
}

export function playSongList(queueSongs, startSongId = queueSongs[0]?.id) {
  if (!queueSongs.length || !startSongId) return;
  playSong(startSongId, queueSongs);
}

export function togglePlay() {
  const s = getState();
  if (!s.playing.song) {
    const allSongs = librarySongs(s);
    playSong(allSongs[0]?.id, allSongs);
    return;
  }
  const isPlaying = !s.playing.isPlaying;
  setState({ playing: { ...s.playing, isPlaying } });

  if (isTauri()) {
    (isPlaying ? ipcResume() : ipcPause()).catch(err => console.warn('[ipc] toggle play failed', err));
  }
}

export function skipTrack(dir) {
  if (isTauri()) {
    ipcSkipTrack(dir).then(result => {
      if (result?.song) {
        const s = getState();
        const recentIds = [result.song.id, ...s.recentIds.filter(id => id !== result.song.id)].slice(0, 20);
        setState({
          playing: { song: result.song, isPlaying: true, progress: 0, duration: result.song.duration },
          queue: result.queue || s.queue,
          queueIndex: result.queueIndex ?? s.queueIndex,
          recentIds,
        });
      }
    }).catch(err => console.warn('[ipc] skip_track failed', err));
    return;
  }

  const s = getState();
  if (!s.playing.song) return;
  if (s.loopMode === 'one') {
    setState({ playing: { ...s.playing, progress: 0, isPlaying: true } });
    return;
  }

  const queue = getQueueSongs(s);
  if (!queue.length) return;

  let nextIndex;
  if (s.shuffle && queue.length > 1) {
    const currentIndex = queue.findIndex(song => song.id === s.playing.song.id);
    const choices = queue.map((_, index) => index).filter(index => index !== currentIndex);
    nextIndex = choices[Math.floor(Math.random() * choices.length)];
  } else {
    const currentIndex = Math.max(0, queue.findIndex(song => song.id === s.playing.song.id));
    nextIndex = currentIndex + dir;
    if (nextIndex < 0) nextIndex = queue.length - 1;
    if (nextIndex >= queue.length) nextIndex = s.loopMode === 'off' ? currentIndex : 0;
  }

  const song = queue[nextIndex];
  setState({
    playing: { ...s.playing, song, progress: 0, duration: song.duration },
    queueIndex: nextIndex,
    recentIds: [song.id, ...s.recentIds.filter(id => id !== song.id)].slice(0, 20),
  });
}

export function setProgressByPointer(event, element) {
  const s = getState();
  if (!s.playing.song || !element.offsetWidth) return;
  const pct = Math.max(0, Math.min(1, event.offsetX / element.offsetWidth));
  const progress = Math.round(pct * s.playing.duration);
  setState({ playing: { ...s.playing, progress } });

  if (isTauri()) {
    ipcSeek(progress).catch(err => console.warn('[ipc] seek failed', err));
  }
}

export function setVolumeByPointer(event, element) {
  if (!element.offsetWidth) return;
  const pct = Math.max(0, Math.min(1, event.offsetX / element.offsetWidth));
  setState({ volume: pct });
  if (isTauri()) {
    ipcSetVolume(pct).catch(err => console.warn('[ipc] set_volume failed', err));
  } else {
    showToast(`音量 ${Math.round(pct * 100)}%`);
  }
}

export async function toggleLike(songId = getState().playing.song?.id) {
  if (!songId) return;
  const s = getState();
  let liked = !s.likedIds.has(songId);
  try {
    const result = await ipcToggleLike(songId);
    if (typeof result?.liked === 'boolean') liked = result.liked;
  } catch (error) {
    console.warn('[ipc] toggle_like failed', error);
  }
  const likedIds = new Set(getState().likedIds);
  if (liked) likedIds.add(songId);
  else likedIds.delete(songId);
  const playlists = getState().playlists.map(playlist => {
    if (playlist.id !== 'liked') return playlist;
    const songIds = liked
      ? Array.from(new Set([...(playlist.songIds || []), songId]))
      : (playlist.songIds || []).filter(id => id !== songId);
    return { ...playlist, songIds };
  });
  setState({ likedIds, playlists });
  showToast(liked ? '已添加到收藏' : '已从收藏移除');
}

export function toggleShuffle() {
  const shuffle = !getState().shuffle;
  setState({ shuffle });
  showToast(shuffle ? '随机播放已开启' : '随机播放已关闭');
}

export function cycleLoopMode() {
  const current = getState().loopMode;
  const loopMode = current === 'list' ? 'one' : current === 'one' ? 'off' : 'list';
  setState({ loopMode });
  if (isTauri()) {
    ipcSetLoopMode(loopMode).catch(err => console.warn('[ipc] set_loop_mode failed', err));
  }
  showToast(loopMode === 'one' ? '单曲循环' : loopMode === 'off' ? '循环已关闭' : '列表循环');
}

export async function addToPlaylist(songId, playlistId = defaultPlaylistId()) {
  await addSongsToPlaylist([songId], playlistId);
}

export async function addSongsToPlaylist(songIds, playlistId = defaultPlaylistId()) {
  if (!playlistId || !songIds.length) return;
  const s = getState();
  let nextPlaylist = null;
  try {
    const result = await ipcAddSongsToPlaylist(playlistId, songIds);
    nextPlaylist = result?.playlist || null;
  } catch (error) {
    console.warn('[ipc] add_songs_to_playlist failed', error);
  }
  const playlists = getState().playlists.map(playlist => {
    if (playlist.id !== playlistId) return playlist;
    if (nextPlaylist) return nextPlaylist;
    return { ...playlist, songIds: Array.from(new Set([...(playlist.songIds || []), ...songIds])) };
  });
  const playlist = playlists.find(item => item.id === playlistId);
  setState({ playlists });
  showToast(`已添加到 ${playlist?.name || '播放列表'}`);
}

export async function createPlaylist() {
  const s = getState();
  const index = s.playlists.filter(item => !item.system).length + 1;
  let playlist;
  try {
    const result = await ipcCreatePlaylist(`新播放列表 ${index}`);
    playlist = result?.playlist;
  } catch (error) {
    console.warn('[ipc] create_playlist failed', error);
  }
  playlist ||= {
    id: `pl-${Date.now()}`,
    name: `新播放列表 ${index}`,
    icon: 'list-music',
    system: false,
    songIds: [],
  };
  if (s.playing.song) {
    await addSongsToPlaylist([s.playing.song.id], playlist.id);
    try {
      const playlists = await getPlaylists();
      playlist = playlists.find(item => item.id === playlist.id) || playlist;
      setState({ playlists });
    } catch {
      playlist = { ...playlist, songIds: [s.playing.song.id] };
    }
  }
  const exists = getState().playlists.some(item => item.id === playlist.id);
  setState({
    playlists: exists
      ? getState().playlists.map(item => item.id === playlist.id ? playlist : item)
      : [...getState().playlists, playlist],
    sidebarActive: `pl-${playlist.id}`,
    view: 'playlist',
    activePlaylistId: playlist.id,
  });
  showToast('已创建播放列表');
}

export async function renamePlaylist(playlistId, name) {
  const s = getState();
  const playlist = s.playlists.find(p => p.id === playlistId);
  if (!playlist) return;
  try {
    const result = await ipcRenamePlaylist(playlistId, name);
    if (result?.success) {
      setState({ playlists: s.playlists.map(p => p.id === playlistId ? { ...p, name } : p) });
      showToast(`已重命名为「${name}」`);
    }
  } catch (error) {
    console.warn('[ipc] rename_playlist failed', error);
  }
}

export async function deletePlaylist(playlistId) {
  const s = getState();
  const playlist = s.playlists.find(p => p.id === playlistId);
  if (!playlist || playlist.system) return;
  try {
    const result = await ipcDeletePlaylist(playlistId);
    if (result?.success) {
      const playlists = s.playlists.filter(p => p.id !== playlistId);
      const next = s.sidebarActive === `pl-${playlistId}` ? 'songs' : s.sidebarActive;
      setState({ playlists, sidebarActive: next });
      showToast(`已删除「${playlist.name}」`);
    }
  } catch (error) {
    console.warn('[ipc] delete_playlist failed', error);
  }
}

export async function removeSongFromPlaylist(playlistId, songId) {
  const s = getState();
  try {
    const result = await ipcRemoveSongFromPlaylist(playlistId, songId);
    const playlists = s.playlists.map(p => {
      if (p.id !== playlistId) return p;
      if (result?.playlist) return result.playlist;
      return { ...p, songIds: (p.songIds || []).filter(id => id !== songId) };
    });
    setState({ playlists });
    showToast('已从播放列表移除');
  } catch (error) {
    console.warn('[ipc] remove_song_from_playlist failed', error);
  }
}

function defaultPlaylistId() {
  return getState().playlists.find(playlist => !playlist.system)?.id || null;
}
