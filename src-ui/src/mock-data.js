export const albums = [
  { id: 'a-1', title: 'A Night at the Opera', artist: 'Queen', year: 1975, songCount: 12, coverClass: 'cover-a' },
  { id: 'a-2', title: 'Hotel California', artist: 'Eagles', year: 1976, songCount: 8, coverClass: 'cover-b' },
  { id: 'a-3', title: 'Led Zeppelin IV', artist: 'Led Zeppelin', year: 1971, songCount: 8, coverClass: 'cover-a' },
  { id: 'a-4', title: '叶惠美', artist: '周杰伦', year: 2003, songCount: 11, coverClass: 'cover-b' },
  { id: 'a-5', title: 'The Dark Side of the Moon', artist: 'Pink Floyd', year: 1973, songCount: 10, coverClass: 'cover-a' },
  { id: 'a-6', title: 'Abbey Road', artist: 'The Beatles', year: 1969, songCount: 17, coverClass: 'cover-b' },
  { id: 'a-7', title: 'Random Access Memories', artist: 'Daft Punk', year: 2013, songCount: 13, coverClass: 'cover-a' },
  { id: 'a-8', title: 'OK Computer', artist: 'Radiohead', year: 1997, songCount: 12, coverClass: 'cover-b' },
];

export const songs = [
  { id: 's-1', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', albumId: 'a-1', duration: 355, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-a', year: 1975, track: '1 / 12' },
  { id: 's-2', title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', albumId: 'a-2', duration: 391, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-b', year: 1976, track: '1 / 8' },
  { id: 's-3', title: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', albumId: 'a-3', duration: 482, format: 'FLAC 96kHz 24bit', coverClass: 'cover-a', year: 1971, track: '4 / 8' },
  { id: 's-4', title: '晴天', artist: '周杰伦', album: '叶惠美', albumId: 'a-4', duration: 269, format: 'MP3 320kbps', coverClass: 'cover-b', year: 2003, track: '2 / 11' },
  { id: 's-5', title: 'Comfortably Numb', artist: 'Pink Floyd', album: 'The Wall', albumId: 'a-5', duration: 383, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-a', year: 1979, track: '' },
  { id: 's-6', title: 'Come Together', artist: 'The Beatles', album: 'Abbey Road', albumId: 'a-6', duration: 260, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-b', year: 1969, track: '1 / 17' },
  { id: 's-7', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', albumId: 'a-7', duration: 369, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-a', year: 2013, track: '8 / 13' },
  { id: 's-8', title: 'Karma Police', artist: 'Radiohead', album: 'OK Computer', albumId: 'a-8', duration: 261, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-b', year: 1997, track: '6 / 12' },
  { id: 's-9', title: '以父之名', artist: '周杰伦', album: '叶惠美', albumId: 'a-4', duration: 342, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-b', year: 2003, track: '1 / 11' },
  { id: 's-10', title: 'Wish You Were Here', artist: 'Pink Floyd', album: 'Wish You Were Here', albumId: 'a-5', duration: 334, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-a', year: 1975, track: '' },
  { id: 's-11', title: 'Something', artist: 'The Beatles', album: 'Abbey Road', albumId: 'a-6', duration: 183, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-b', year: 1969, track: '2 / 17' },
  { id: 's-12', title: 'Instant Crush', artist: 'Daft Punk ft. Julian Casablancas', album: 'Random Access Memories', albumId: 'a-7', duration: 337, format: 'FLAC 44.1kHz 16bit', coverClass: 'cover-a', year: 2013, track: '7 / 13' },
];

export const lyricsData = {
  's-1': [
    '', 'Is this the real life?', 'Is this just fantasy?', 'Caught in a landslide',
    'No escape from reality', 'Open your eyes', 'Look up to the skies and see',
    "I'm just a poor boy", 'I need no sympathy', "Because I'm easy come, easy go",
    'Little high, little low', 'Any way the wind blows', "Doesn't really matter to me", 'To me',
    '', 'Mama, just killed a man', 'Put a gun against his head',
    "Pulled my trigger, now he's dead", 'Mama, life had just begun',
    "But now I've gone and thrown it all away", '', 'Mama, ooh',
    "Didn't mean to make you cry", "If I'm not back again this time tomorrow",
    'Carry on, carry on', 'As if nothing really matters',
  ],
};

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getProgressPercent(state) {
  if (!state.playing.song || state.playing.duration === 0) return 0;
  return state.playing.progress / state.playing.duration;
}
