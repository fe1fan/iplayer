use crate::{
    db::repository::{
        albums::upsert_album, liked::set_liked, playlists::upsert_playlist, songs::upsert_song,
    },
    error::CommandResult,
    model::library::{Album, Playlist, Song},
};
use rusqlite::Connection;

#[derive(Debug, Clone)]
pub struct LibrarySeed {
    pub songs: Vec<Song>,
    pub albums: Vec<Album>,
    pub playlists: Vec<Playlist>,
    pub liked_ids: Vec<String>,
}

pub fn seed_demo_data(conn: &Connection, seed: &LibrarySeed) -> CommandResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM songs", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    for album in &seed.albums {
        upsert_album(conn, album)?;
    }
    for song in &seed.songs {
        upsert_song(conn, song)?;
    }
    for (position, playlist) in seed.playlists.iter().enumerate() {
        upsert_playlist(conn, playlist, position as i64)?;
    }
    for song_id in &seed.liked_ids {
        set_liked(conn, song_id, true)?;
    }

    Ok(())
}

pub fn demo_seed() -> LibrarySeed {
    let albums = vec![
        album("a-1", "A Night at the Opera", "Queen", 1975, 12, "cover-a"),
        album("a-2", "Hotel California", "Eagles", 1976, 8, "cover-b"),
        album("a-3", "Led Zeppelin IV", "Led Zeppelin", 1971, 8, "cover-a"),
        album("a-4", "叶惠美", "周杰伦", 2003, 11, "cover-b"),
        album(
            "a-5",
            "The Dark Side of the Moon",
            "Pink Floyd",
            1973,
            10,
            "cover-a",
        ),
        album("a-6", "Abbey Road", "The Beatles", 1969, 17, "cover-b"),
        album(
            "a-7",
            "Random Access Memories",
            "Daft Punk",
            2013,
            13,
            "cover-a",
        ),
        album("a-8", "OK Computer", "Radiohead", 1997, 12, "cover-b"),
    ];

    let songs = vec![
        song(
            "s-1",
            "Bohemian Rhapsody",
            "Queen",
            "A Night at the Opera",
            "a-1",
            355,
            "FLAC 44.1kHz 16bit",
            "cover-a",
            1975,
            "1 / 12",
        ),
        song(
            "s-2",
            "Hotel California",
            "Eagles",
            "Hotel California",
            "a-2",
            391,
            "FLAC 44.1kHz 16bit",
            "cover-b",
            1976,
            "1 / 8",
        ),
        song(
            "s-3",
            "Stairway to Heaven",
            "Led Zeppelin",
            "Led Zeppelin IV",
            "a-3",
            482,
            "FLAC 96kHz 24bit",
            "cover-a",
            1971,
            "4 / 8",
        ),
        song(
            "s-4",
            "晴天",
            "周杰伦",
            "叶惠美",
            "a-4",
            269,
            "MP3 320kbps",
            "cover-b",
            2003,
            "2 / 11",
        ),
        song(
            "s-5",
            "Comfortably Numb",
            "Pink Floyd",
            "The Wall",
            "a-5",
            383,
            "FLAC 44.1kHz 16bit",
            "cover-a",
            1979,
            "",
        ),
        song(
            "s-6",
            "Come Together",
            "The Beatles",
            "Abbey Road",
            "a-6",
            260,
            "FLAC 44.1kHz 16bit",
            "cover-b",
            1969,
            "1 / 17",
        ),
        song(
            "s-7",
            "Get Lucky",
            "Daft Punk",
            "Random Access Memories",
            "a-7",
            369,
            "FLAC 44.1kHz 16bit",
            "cover-a",
            2013,
            "8 / 13",
        ),
        song(
            "s-8",
            "Karma Police",
            "Radiohead",
            "OK Computer",
            "a-8",
            261,
            "FLAC 44.1kHz 16bit",
            "cover-b",
            1997,
            "6 / 12",
        ),
        song(
            "s-9",
            "以父之名",
            "周杰伦",
            "叶惠美",
            "a-4",
            342,
            "FLAC 44.1kHz 16bit",
            "cover-b",
            2003,
            "1 / 11",
        ),
        song(
            "s-10",
            "Wish You Were Here",
            "Pink Floyd",
            "Wish You Were Here",
            "a-5",
            334,
            "FLAC 44.1kHz 16bit",
            "cover-a",
            1975,
            "",
        ),
        song(
            "s-11",
            "Something",
            "The Beatles",
            "Abbey Road",
            "a-6",
            183,
            "FLAC 44.1kHz 16bit",
            "cover-b",
            1969,
            "2 / 17",
        ),
        song(
            "s-12",
            "Instant Crush",
            "Daft Punk ft. Julian Casablancas",
            "Random Access Memories",
            "a-7",
            337,
            "FLAC 44.1kHz 16bit",
            "cover-a",
            2013,
            "7 / 13",
        ),
    ];

    let playlists = vec![
        playlist("liked", "收藏", "heart", true, vec![]),
        playlist("recent", "最近播放", "clock", true, vec![]),
        playlist(
            "pl-1",
            "深夜学习",
            "list-music",
            false,
            vec!["s-1", "s-4", "s-8", "s-10"],
        ),
        playlist(
            "pl-2",
            "晨间通勤",
            "list-music",
            false,
            vec!["s-2", "s-6", "s-7", "s-12"],
        ),
    ];

    LibrarySeed {
        songs,
        albums,
        playlists,
        liked_ids: vec!["s-1".into()],
    }
}

fn album(
    id: &str,
    title: &str,
    artist: &str,
    year: i32,
    song_count: usize,
    cover_class: &str,
) -> Album {
    Album {
        id: id.into(),
        title: title.into(),
        artist: artist.into(),
        year,
        song_count,
        cover_class: cover_class.into(),
    }
}

#[allow(clippy::too_many_arguments)]
fn song(
    id: &str,
    title: &str,
    artist: &str,
    album: &str,
    album_id: &str,
    duration: u64,
    format: &str,
    cover_class: &str,
    year: i32,
    track: &str,
) -> Song {
    Song {
        id: id.into(),
        file_path: None,
        folder_id: None,
        cover_url: None,
        title: title.into(),
        artist: artist.into(),
        album: album.into(),
        album_id: album_id.into(),
        duration,
        format: format.into(),
        cover_class: cover_class.into(),
        year,
        track: track.into(),
    }
}

fn playlist(id: &str, name: &str, icon: &str, system: bool, song_ids: Vec<&str>) -> Playlist {
    Playlist {
        id: id.into(),
        name: name.into(),
        icon: icon.into(),
        system,
        song_ids: song_ids.into_iter().map(String::from).collect(),
    }
}
