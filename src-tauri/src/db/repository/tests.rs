use super::{
    albums::list_albums,
    import::{import_scanned_songs, stable_hash},
    liked::{is_liked, toggle_like},
    playlists::{
        add_songs_to_playlist, create_playlist, delete_playlist, list_playlists,
        remove_song_from_playlist, rename_playlist, upsert_playlist,
    },
    songs::{get_song, list_songs, search_songs, update_song_metadata},
};
use crate::{
    db::{
        migrations,
        seed::{seed_demo_data, LibrarySeed},
    },
    model::library::{Album, MetadataPatch, Playlist, Song},
};
use rusqlite::Connection;

#[test]
fn seeds_and_queries_library_data() {
    let conn = setup();

    let songs = list_songs(&conn).expect("songs");
    let albums = list_albums(&conn).expect("albums");
    let playlists = list_playlists(&conn).expect("playlists");

    assert_eq!(songs.len(), 2);
    assert_eq!(albums.len(), 1);
    assert_eq!(playlists.len(), 1);
    assert_eq!(
        playlists[0].song_ids,
        vec!["s-1".to_string(), "s-2".to_string()]
    );
}

#[test]
fn searches_and_updates_song_metadata() {
    let conn = setup();

    let results = search_songs(&conn, "bohemian").expect("search");
    assert_eq!(results.len(), 1);

    let updated = update_song_metadata(
        &conn,
        "s-1",
        MetadataPatch {
            title: Some("Bohemian Rhapsody Remastered".into()),
            artist: None,
            album: None,
            year: Some(1976),
            track: None,
            cover_url: None,
        },
    )
    .expect("update");

    assert_eq!(updated.title, "Bohemian Rhapsody Remastered");
    assert_eq!(get_song(&conn, "s-1").expect("song").unwrap().year, 1976);
}

#[test]
fn persists_playlist_and_like_changes() {
    let conn = setup();

    let playlist = create_playlist(&conn, Some("测试列表".into())).expect("playlist");
    assert_eq!(playlist.name, "测试列表");
    assert!(list_playlists(&conn)
        .expect("playlists")
        .iter()
        .any(|item| item.id == playlist.id));

    assert!(!is_liked(&conn, "s-2").expect("liked"));
    assert!(toggle_like(&conn, "s-2").expect("toggle"));
    assert!(is_liked(&conn, "s-2").expect("liked"));
    assert!(!toggle_like(&conn, "s-2").expect("toggle"));
}

#[test]
fn adds_songs_to_regular_playlists() {
    let conn = setup();
    let playlist = create_playlist(&conn, Some("添加测试".into())).expect("playlist");
    let updated = add_songs_to_playlist(&conn, &playlist.id, &["s-1".into(), "s-2".into()])
        .expect("add songs");

    assert_eq!(updated.song_ids, vec!["s-1".to_string(), "s-2".to_string()]);
}

#[test]
fn renames_deletes_and_removes_from_playlists() {
    let conn = setup();
    let playlist = create_playlist(&conn, Some("原名".into())).expect("playlist");
    let _ =
        add_songs_to_playlist(&conn, &playlist.id, &["s-1".into(), "s-2".into()]).expect("add");

    let renamed = rename_playlist(&conn, &playlist.id, "新名").expect("rename");
    assert_eq!(renamed.name, "新名");
    assert_eq!(renamed.song_ids.len(), 2);

    let updated = remove_song_from_playlist(&conn, &playlist.id, "s-1").expect("remove");
    assert_eq!(updated.song_ids, vec!["s-2".to_string()]);

    assert!(delete_playlist(&conn, &playlist.id).expect("delete"));
    let remaining = list_playlists(&conn).expect("list");
    assert!(!remaining.iter().any(|p| p.id == playlist.id));
}

#[test]
fn rejects_operations_on_system_playlists() {
    let conn = setup();
    let system_pl = Playlist {
        id: "sys-1".into(),
        name: "系统列表".into(),
        icon: "clock".into(),
        system: true,
        song_ids: vec!["s-1".into()],
    };
    upsert_playlist(&conn, &system_pl, 0).expect("seed system playlist");

    let result = rename_playlist(&conn, "sys-1", "x");
    assert!(result.is_err());

    let result = delete_playlist(&conn, "sys-1");
    assert!(result.is_err());

    let result = remove_song_from_playlist(&conn, "sys-1", "s-1");
    assert!(result.is_err());
}

#[test]
fn imports_scanned_songs_and_rebuilds_albums() {
    let conn = setup();
    let scanned = Song {
        id: "song-scan-1".into(),
        file_path: Some("/tmp/music/new-track.flac".into()),
        folder_id: None,
        cover_url: None,
        title: "New Track".into(),
        artist: "New Artist".into(),
        album: "New Album".into(),
        album_id: "album-new".into(),
        duration: 180,
        format: "FLAC".into(),
        cover_class: "cover-b".into(),
        year: 2026,
        track: "1".into(),
    };

    import_scanned_songs(&conn, "/tmp/music", &[scanned]).expect("import scan");

    let songs = search_songs(&conn, "new track").expect("search");
    assert_eq!(songs.len(), 1);
    let expected_folder_id = format!("folder-{}", stable_hash("/tmp/music"));
    assert_eq!(
        songs[0].folder_id.as_deref(),
        Some(expected_folder_id.as_str())
    );

    let albums = list_albums(&conn).expect("albums");
    assert!(albums.iter().any(|album| album.id == "album-new"));
}

fn setup() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    migrations::run(&conn).expect("migrate");
    seed_demo_data(&conn, &seed()).expect("seed");
    conn
}

fn seed() -> LibrarySeed {
    LibrarySeed {
        albums: vec![Album {
            id: "a-1".into(),
            title: "A Night at the Opera".into(),
            artist: "Queen".into(),
            year: 1975,
            song_count: 2,
            cover_class: "cover-a".into(),
        }],        songs: vec![
            Song {
                id: "s-1".into(),
                file_path: None,
                folder_id: None,
                cover_url: None,
                title: "Bohemian Rhapsody".into(),
                artist: "Queen".into(),
                album: "A Night at the Opera".into(),
                album_id: "a-1".into(),
                duration: 355,
                format: "FLAC".into(),
                cover_class: "cover-a".into(),
                year: 1975,
                track: "1 / 2".into(),
            },
            Song {
                id: "s-2".into(),
                file_path: None,
                folder_id: None,
                cover_url: None,
                title: "Love of My Life".into(),
                artist: "Queen".into(),
                album: "A Night at the Opera".into(),
                album_id: "a-1".into(),
                duration: 218,
                format: "FLAC".into(),
                cover_class: "cover-a".into(),
                year: 1975,
                track: "2 / 2".into(),
            },
        ],
        playlists: vec![Playlist {
            id: "pl-1".into(),
            name: "测试歌单".into(),
            icon: "list-music".into(),
            system: false,
            song_ids: vec!["s-1".into(), "s-2".into()],
        }],
        liked_ids: vec!["s-1".into()],
    }
}
