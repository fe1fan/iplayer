use crate::{
    error::{AppError, CommandResult},
    model::library::{Album, MetadataPatch, Playlist, Song},
};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use uuid::Uuid;

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

pub fn import_scanned_songs(
    conn: &Connection,
    root_path: &str,
    songs: &[Song],
) -> CommandResult<()> {
    let folder_id = format!("folder-{}", stable_hash(root_path));
    let folder_name = Path::new(root_path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(root_path);

    conn.execute(
        "
        INSERT INTO folders (id, name, path)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![folder_id, folder_name, root_path],
    )?;

    if !songs.is_empty() {
        conn.execute("DELETE FROM songs WHERE file_path IS NULL", [])?;
    }

    for song in songs {
        let mut song = song.clone();
        if song.folder_id.is_none() {
            song.folder_id = Some(folder_id.clone());
        }
        upsert_song(conn, &song)?;
    }

    rebuild_library_facets(conn)
}

pub fn list_songs(conn: &Connection) -> CommandResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map([], map_song)?;
    collect_songs(rows)
}

pub fn list_albums(conn: &Connection) -> CommandResult<Vec<Album>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, year, song_count, cover_class
        FROM albums
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Album {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            year: row.get(3)?,
            song_count: row.get::<_, i64>(4)? as usize,
            cover_class: row.get(5)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn search_songs(conn: &Connection, query: &str) -> CommandResult<Vec<Song>> {
    let query = query.trim();
    if query.is_empty() {
        return list_songs(conn);
    }

    let pattern = format!("%{}%", query.to_lowercase());
    let mut stmt = conn.prepare(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        WHERE lower(title) LIKE ?1 OR lower(artist) LIKE ?1 OR lower(album) LIKE ?1
        ORDER BY title COLLATE NOCASE
        ",
    )?;
    let rows = stmt.query_map(params![pattern], map_song)?;
    collect_songs(rows)
}

pub fn get_song(conn: &Connection, song_id: &str) -> CommandResult<Option<Song>> {
    conn.query_row(
        "
        SELECT id, title, artist, album, album_id, duration, format, cover_class, year, track, file_path, folder_id, cover_url
        FROM songs
        WHERE id = ?1
        ",
        params![song_id],
        map_song,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn update_song_metadata(
    conn: &Connection,
    song_id: &str,
    patch: MetadataPatch,
) -> CommandResult<Song> {
    let mut song = get_song(conn, song_id)?.ok_or_else(|| AppError::not_found("song not found"))?;

    if let Some(title) = patch.title {
        song.title = title;
    }
    if let Some(artist) = patch.artist {
        song.artist = artist;
    }
    if let Some(album) = patch.album {
        song.album = album;
    }
    if let Some(year) = patch.year {
        song.year = year;
    }
    if let Some(track) = patch.track {
        song.track = track;
    }
    if let Some(cover_url) = patch.cover_url {
        song.cover_url = Some(cover_url);
    }

    conn.execute(
        "
        UPDATE songs
        SET title = ?2, artist = ?3, album = ?4, year = ?5, track = ?6, cover_url = ?7, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![song.id, song.title, song.artist, song.album, song.year, song.track, song.cover_url],
    )?;

    rebuild_library_facets(conn)?;
    Ok(song)
}

pub fn list_playlists(conn: &Connection) -> CommandResult<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "
        SELECT id, name, icon, system
        FROM playlists
        ORDER BY system DESC, position ASC, created_at ASC
        ",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)? != 0,
        ))
    })?;

    let mut playlists = Vec::new();
    for row in rows {
        let (id, name, icon, system) = row?;
        let song_ids = if id == "liked" {
            liked_song_ids(conn)?
        } else if id == "recent" {
            recent_song_ids(conn)?
        } else {
            playlist_song_ids(conn, &id)?
        };
        playlists.push(Playlist {
            song_ids,
            id,
            name,
            icon,
            system,
        });
    }
    Ok(playlists)
}

pub fn create_playlist(conn: &Connection, name: Option<String>) -> CommandResult<Playlist> {
    let index: i64 = conn.query_row(
        "SELECT COUNT(*) + 1 FROM playlists WHERE system = 0",
        [],
        |row| row.get(0),
    )?;
    let playlist = Playlist {
        id: format!("pl-{}", Uuid::new_v4()),
        name: name.unwrap_or_else(|| format!("新播放列表 {}", index)),
        icon: "list-music".into(),
        system: false,
        song_ids: Vec::new(),
    };
    upsert_playlist(conn, &playlist, index + 100)?;
    Ok(playlist)
}

pub fn add_songs_to_playlist(
    conn: &Connection,
    playlist_id: &str,
    song_ids: &[String],
) -> CommandResult<Playlist> {
    let playlist = get_playlist(conn, playlist_id)?
        .ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state(
            "system playlists cannot be modified directly",
        ));
    }

    let mut position: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    )?;
    for song_id in song_ids {
        if get_song(conn, song_id)?.is_none() {
            continue;
        }
        conn.execute(
            "
            INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position)
            VALUES (?1, ?2, ?3)
            ",
            params![playlist_id, song_id, position],
        )?;
        position += 1;
    }

    get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))
}

pub fn rename_playlist(conn: &Connection, playlist_id: &str, name: &str) -> CommandResult<Playlist> {
    let mut playlist = get_playlist(conn, playlist_id)?
        .ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state("system playlists cannot be renamed"));
    }
    conn.execute(
        "UPDATE playlists SET name = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![playlist_id, name],
    )?;
    playlist.name = name.to_string();
    Ok(playlist)
}

pub fn delete_playlist(conn: &Connection, playlist_id: &str) -> CommandResult<bool> {
    let playlist = get_playlist(conn, playlist_id)?;
    let Some(playlist) = playlist else { return Ok(false) };
    if playlist.system {
        return Err(AppError::state("system playlists cannot be deleted"));
    }
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])?;
    Ok(true)
}

pub fn remove_song_from_playlist(
    conn: &Connection,
    playlist_id: &str,
    song_id: &str,
) -> CommandResult<Playlist> {
    let playlist = get_playlist(conn, playlist_id)?
        .ok_or_else(|| AppError::not_found("playlist not found"))?;
    if playlist.system {
        return Err(AppError::state(
            "songs cannot be removed from system playlists directly",
        ));
    }
    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        params![playlist_id, song_id],
    )?;
    get_playlist(conn, playlist_id)?.ok_or_else(|| AppError::not_found("playlist not found"))
}

pub fn list_watched_folders(conn: &Connection) -> CommandResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT id, path FROM folders")?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn toggle_like(conn: &Connection, song_id: &str) -> CommandResult<bool> {
    if get_song(conn, song_id)?.is_none() {
        return Err(AppError::not_found("song not found"));
    }

    let liked = is_liked(conn, song_id)?;
    set_liked(conn, song_id, !liked)?;
    Ok(!liked)
}

pub fn is_liked(conn: &Connection, song_id: &str) -> CommandResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM liked_songs WHERE song_id = ?1",
        params![song_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn set_liked(conn: &Connection, song_id: &str, liked: bool) -> CommandResult<()> {
    if liked {
        conn.execute(
            "INSERT OR IGNORE INTO liked_songs (song_id) VALUES (?1)",
            params![song_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM liked_songs WHERE song_id = ?1",
            params![song_id],
        )?;
    }
    Ok(())
}

fn upsert_album(conn: &Connection, album: &Album) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO albums (id, title, artist, year, song_count, cover_class)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          artist = excluded.artist,
          year = excluded.year,
          song_count = excluded.song_count,
          cover_class = excluded.cover_class,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            album.id,
            album.title,
            album.artist,
            album.year,
            album.song_count as i64,
            album.cover_class
        ],
    )?;
    Ok(())
}

fn rebuild_library_facets(conn: &Connection) -> CommandResult<()> {
    conn.execute("DELETE FROM albums", [])?;
    conn.execute(
        "
        INSERT INTO albums (id, title, artist, year, song_count, cover_class)
        SELECT
          album_id,
          album,
          MIN(artist),
          COALESCE(NULLIF(MIN(year), 0), 0),
          COUNT(*),
          MIN(cover_class)
        FROM songs
        GROUP BY album_id, album
        ",
        [],
    )?;

    conn.execute("DELETE FROM artists", [])?;
    conn.execute(
        "
        INSERT INTO artists (id, name, song_count, album_count)
        SELECT
          'artist-' || lower(hex(name)),
          name,
          COUNT(*),
          COUNT(DISTINCT album_id)
        FROM (
          SELECT artist AS name, album_id
          FROM songs
        )
        GROUP BY name
        ",
        [],
    )?;

    Ok(())
}

fn upsert_song(conn: &Connection, song: &Song) -> CommandResult<()> {
    if let Some(file_path) = song.file_path.as_deref() {
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM songs WHERE file_path = ?1",
                params![file_path],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(existing_id) = existing_id {
            update_song_row(conn, &existing_id, song)?;
            return Ok(());
        }
    }

    conn.execute(
        "
        INSERT INTO songs (id, file_path, folder_id, title, artist, album, album_id, duration, format, cover_class, year, track, cover_url)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(id) DO UPDATE SET
          file_path = excluded.file_path,
          title = excluded.title,
          artist = excluded.artist,
          album = excluded.album,
          album_id = excluded.album_id,
          duration = excluded.duration,
          format = excluded.format,
          cover_class = excluded.cover_class,
          year = excluded.year,
          track = excluded.track,
          folder_id = excluded.folder_id,
          cover_url = excluded.cover_url,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            song.id,
            song.file_path,
            song.folder_id,
            song.title,
            song.artist,
            song.album,
            song.album_id,
            song.duration as i64,
            song.format,
            song.cover_class,
            song.year,
            song.track,
            song.cover_url
        ],
    )?;
    Ok(())
}

fn update_song_row(conn: &Connection, song_id: &str, song: &Song) -> CommandResult<()> {
    conn.execute(
        "
        UPDATE songs
        SET
          file_path = ?2,
          folder_id = ?3,
          title = ?4,
          artist = ?5,
          album = ?6,
          album_id = ?7,
          duration = ?8,
          format = ?9,
          cover_class = ?10,
          year = ?11,
          track = ?12,
          cover_url = ?13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![
            song_id,
            song.file_path,
            song.folder_id,
            song.title,
            song.artist,
            song.album,
            song.album_id,
            song.duration as i64,
            song.format,
            song.cover_class,
            song.year,
            song.track,
            song.cover_url
        ],
    )?;
    Ok(())
}

fn upsert_playlist(conn: &Connection, playlist: &Playlist, position: i64) -> CommandResult<()> {
    conn.execute(
        "
        INSERT INTO playlists (id, name, icon, system, position)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          system = excluded.system,
          position = excluded.position,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            playlist.id,
            playlist.name,
            playlist.icon,
            if playlist.system { 1 } else { 0 },
            position
        ],
    )?;

    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1",
        params![playlist.id],
    )?;
    for (position, song_id) in playlist.song_ids.iter().enumerate() {
        conn.execute(
            "
            INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position)
            VALUES (?1, ?2, ?3)
            ",
            params![playlist.id, song_id, position as i64],
        )?;
    }

    Ok(())
}

fn playlist_song_ids(conn: &Connection, playlist_id: &str) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM playlist_songs
        WHERE playlist_id = ?1
        ORDER BY position ASC, created_at ASC
        ",
    )?;
    let rows = stmt.query_map(params![playlist_id], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn liked_song_ids(conn: &Connection) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM liked_songs
        ORDER BY created_at DESC
        ",
    )?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn recent_song_ids(conn: &Connection) -> CommandResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "
        SELECT song_id
        FROM recent_plays
        GROUP BY song_id
        ORDER BY MAX(played_at) DESC
        LIMIT 100
        ",
    )?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn get_playlist(conn: &Connection, playlist_id: &str) -> CommandResult<Option<Playlist>> {
    let row = conn
        .query_row(
            "
            SELECT id, name, icon, system
            FROM playlists
            WHERE id = ?1
            ",
            params![playlist_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)? != 0,
                ))
            },
        )
        .optional()?;

    let Some((id, name, icon, system)) = row else {
        return Ok(None);
    };
    let song_ids = if id == "liked" {
        liked_song_ids(conn)?
    } else if id == "recent" {
        recent_song_ids(conn)?
    } else {
        playlist_song_ids(conn, &id)?
    };
    Ok(Some(Playlist {
        id,
        name,
        icon,
        system,
        song_ids,
    }))
}

fn collect_songs(
    rows: impl Iterator<Item = Result<Song, rusqlite::Error>>,
) -> CommandResult<Vec<Song>> {
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn map_song(row: &rusqlite::Row<'_>) -> rusqlite::Result<Song> {
    Ok(Song {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        album_id: row.get(4)?,
        duration: row.get::<_, i64>(5)? as u64,
        format: row.get(6)?,
        cover_class: row.get(7)?,
        year: row.get(8)?,
        track: row.get(9)?,
        file_path: row.get(10)?,
        folder_id: row.get(11)?,
        cover_url: row.get(12)?,
    })
}

fn stable_hash(input: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

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
        let _ = add_songs_to_playlist(&conn, &playlist.id, &["s-1".into(), "s-2".into()])
            .expect("add");

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
            }],
            songs: vec![
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
}
