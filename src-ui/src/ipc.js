import { songs, albums, lyricsData } from './mock-data.js';

export async function scanLibrary(path) {
  return { songs, albums, total: songs.length };
}

export async function searchSongs(query) {
  if (!query) return songs;
  const q = query.toLowerCase();
  return songs.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    s.album.toLowerCase().includes(q)
  );
}

export async function getSongMetadata(songId) {
  return songs.find(s => s.id === songId) || null;
}

export async function updateMetadata(songId, data) {
  return { success: true };
}

export async function getLyrics(songId) {
  return lyricsData[songId] || null;
}

export async function toggleLike(songId) {
  return { success: true };
}

export async function getPlaylists() {
  return [];
}
