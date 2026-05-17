use crate::{
    db::repository::{albums, songs},
    error::CommandResult,
    model::library::Song,
};
use rusqlite::{params, Connection};
use std::path::Path;

pub fn import_scanned_songs(
    conn: &Connection,
    root_path: &str,
    songs_in: &[Song],
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

    if !songs_in.is_empty() {
        conn.execute("DELETE FROM songs WHERE file_path IS NULL", [])?;
    }

    for song in songs_in {
        let mut song = song.clone();
        if song.folder_id.is_none() {
            song.folder_id = Some(folder_id.clone());
        }
        songs::upsert_song(conn, &song)?;
    }

    albums::rebuild_library_facets(conn)
}

pub(crate) fn stable_hash(input: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}
