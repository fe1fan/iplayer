import { getState, setState } from './state.js';
import { songs } from './mock-data.js';
import { showToast } from './components/toast.js';

export function getSongById(songId) {
  return songs.find(song => song.id === songId) || null;
}

export function getQueueSongs(state = getState()) {
  const queue = state.queue?.length ? state.queue : songs.map(song => song.id);
  return queue.map(getSongById).filter(Boolean);
}

export function playSong(songId, queueSongs = songs) {
  const song = getSongById(songId);
  if (!song) return;

  const queue = queueSongs.length ? queueSongs.map(item => item.id) : songs.map(item => item.id);
  const queueIndex = Math.max(0, queue.indexOf(song.id));
  const recentIds = [song.id, ...getState().recentIds.filter(id => id !== song.id)].slice(0, 20);

  setState({
    playing: { song, isPlaying: true, progress: 0, duration: song.duration },
    queue,
    queueIndex,
    recentIds,
  });
}

export function playSongList(queueSongs, startSongId = queueSongs[0]?.id) {
  if (!queueSongs.length || !startSongId) return;
  playSong(startSongId, queueSongs);
}

export function togglePlay() {
  const s = getState();
  if (!s.playing.song) {
    playSong(songs[0]?.id, songs);
    return;
  }
  setState({ playing: { ...s.playing, isPlaying: !s.playing.isPlaying } });
}

export function skipTrack(dir) {
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
  setState({ playing: { ...s.playing, progress: Math.round(pct * s.playing.duration) } });
}

export function setVolumeByPointer(event, element) {
  if (!element.offsetWidth) return;
  const pct = Math.max(0, Math.min(1, event.offsetX / element.offsetWidth));
  setState({ volume: pct });
  showToast(`音量 ${Math.round(pct * 100)}%`);
}

export function toggleLike(songId = getState().playing.song?.id) {
  if (!songId) return;
  const s = getState();
  const likedIds = new Set(s.likedIds);
  const liked = !likedIds.has(songId);
  if (liked) likedIds.add(songId);
  else likedIds.delete(songId);
  setState({ likedIds });
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
  showToast(loopMode === 'one' ? '单曲循环' : loopMode === 'off' ? '循环已关闭' : '列表循环');
}

export function addToPlaylist(songId, playlistId = 'pl-1') {
  addSongsToPlaylist([songId], playlistId);
}

export function addSongsToPlaylist(songIds, playlistId = 'pl-1') {
  const s = getState();
  const playlists = s.playlists.map(playlist => {
    if (playlist.id !== playlistId) return playlist;
    const nextIds = Array.from(new Set([...(playlist.songIds || []), ...songIds]));
    return { ...playlist, songIds: nextIds };
  });
  const playlist = playlists.find(item => item.id === playlistId);
  setState({ playlists });
  showToast(`已添加到 ${playlist?.name || '播放列表'}`);
}

export function createPlaylist() {
  const s = getState();
  const index = s.playlists.filter(item => !item.system).length + 1;
  const playlist = {
    id: `pl-${Date.now()}`,
    name: `新播放列表 ${index}`,
    icon: 'list-music',
    system: false,
    songIds: s.playing.song ? [s.playing.song.id] : [],
  };
  setState({
    playlists: [...s.playlists, playlist],
    sidebarActive: `pl-${playlist.id}`,
    view: 'playlist',
    activePlaylistId: playlist.id,
  });
  showToast('已创建播放列表');
}
