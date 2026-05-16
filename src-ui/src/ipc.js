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
