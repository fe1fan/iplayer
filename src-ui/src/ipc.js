import { invoke, isTauri } from '@tauri-apps/api/core';
import { songs, albums, lyricsData } from './mock-data.js';

async function invokeOrFallback(command, args, fallback) {
  try {
    if (!isTauri()) return fallback();
    return await invoke(command, args);
  } catch (error) {
    console.warn(`[ipc] ${command} failed, using mock fallback`, error);
    return fallback();
  }
}

export async function scanLibrary(path) {
  return invokeOrFallback('scan_library', { path }, () => ({ songs, albums, total: songs.length }));
}

export async function pickAndScanLibrary() {
  if (isTauri()) {
    return invoke('pick_and_scan_library');
  }

  const path = window.prompt('输入要导入的音乐文件夹路径');
  if (!path) return null;
  return scanLibrary(path);
}

export function describeIpcError(error) {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  return error.message || error.code || JSON.stringify(error);
}

export async function getLibrary() {
  return invokeOrFallback('get_library', {}, () => ({ songs, albums, total: songs.length }));
}

export async function searchSongs(query) {
  return invokeOrFallback('search_songs', { query: query || '' }, () => {
    if (!query) return songs;
    const q = query.toLowerCase();
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
    );
  });
}

export async function getSongMetadata(songId) {
  return invokeOrFallback('get_song_metadata', { songId }, () => songs.find(s => s.id === songId) || null);
}

export async function updateMetadata(songId, data) {
  return invokeOrFallback('update_metadata', { songId, data }, () => {
    const song = songs.find(s => s.id === songId) || null;
    return { success: true, song: song ? { ...song, ...data } : null };
  });
}

export async function getLyrics(songId) {
  return invokeOrFallback('get_lyrics', { songId }, () => lyricsData[songId] || null);
}

export async function toggleLike(songId) {
  return invokeOrFallback('toggle_like', { songId }, () => ({ success: true }));
}

export async function getPlaylists() {
  return invokeOrFallback('get_playlists', {}, () => []);
}

export async function createPlaylist(name) {
  return invokeOrFallback('create_playlist', { name }, () => ({
    success: true,
    playlist: {
      id: `pl-${Date.now()}`,
      name: name || '新播放列表',
      icon: 'list-music',
      system: false,
      songIds: [],
    },
  }));
}

export async function addSongsToPlaylist(playlistId, songIds) {
  return invokeOrFallback('add_songs_to_playlist', { playlistId, songIds }, () => ({
    success: true,
    playlist: null,
  }));
}

export async function renamePlaylist(playlistId, name) {
  return invokeOrFallback('rename_playlist', { playlistId, name }, () => ({
    success: true,
    playlist: { id: playlistId, name, icon: 'list-music', system: false, songIds: [] },
  }));
}

export async function deletePlaylist(playlistId) {
  return invokeOrFallback('delete_playlist', { playlistId }, () => ({ success: true }));
}

export async function removeSongFromPlaylist(playlistId, songId) {
  return invokeOrFallback('remove_song_from_playlist', { playlistId, songId }, () => ({
    success: true,
    playlist: null,
  }));
}
