use crate::{
    error::{AppError, CommandResult},
    model::library::Song,
};
use lofty::{
    file::{AudioFile, TaggedFileExt},
    tag::Accessor,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub root_path: String,
    pub songs: Vec<Song>,
    pub skipped: usize,
}

pub fn scan_path(path: impl AsRef<Path>) -> CommandResult<ScanResult> {
    let root = path.as_ref();
    if !root.exists() {
        return Err(AppError::not_found("library path does not exist"));
    }
    if !root.is_dir() {
        return Err(AppError::state("library path must be a directory"));
    }

    let root = root.canonicalize()?;
    let root_path = root.to_string_lossy().to_string();
    let folder_id = format!("folder-{}", stable_hash(&root_path));
    let mut files = Vec::new();
    collect_audio_files(&root, &mut files)?;

    let mut songs = Vec::new();
    let mut skipped = 0;
    for file in files {
        match read_song(&file, &folder_id) {
            Ok(song) => songs.push(song),
            Err(error) => {
                log::warn!(
                    "failed to read audio metadata for {}: {error}",
                    file.display()
                );
                skipped += 1;
            }
        }
    }

    Ok(ScanResult {
        root_path,
        songs,
        skipped,
    })
}

fn collect_audio_files(dir: &Path, out: &mut Vec<PathBuf>) -> CommandResult<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_audio_files(&path, out)?;
        } else if is_audio_file(&path) {
            out.push(path);
        }
    }
    Ok(())
}

fn read_song(path: &Path, folder_id: &str) -> CommandResult<Song> {
    let path = path.canonicalize()?;
    let path_str = path.to_string_lossy().to_string();
    let tagged_file = lofty::read_from_path(&path)?;
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.tags().first());

    let fallback_title = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled");
    let title = tag
        .and_then(|tag| tag.title())
        .map(|value| value.into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| fallback_title.to_string());
    let artist = tag
        .and_then(|tag| tag.artist())
        .map(|value| value.into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Unknown Artist".to_string());
    let album = tag
        .and_then(|tag| tag.album())
        .map(|value| value.into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Unknown Album".to_string());
    let year = tag.and_then(|tag| tag.year()).unwrap_or(0) as i32;
    let track = track_label(tag);
    let album_id = format!("album-{}", stable_hash(&format!("{artist}\u{1f}{album}")));
    let duration = tagged_file.properties().duration().as_secs();
    let format = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_uppercase())
        .unwrap_or_else(|| "AUDIO".to_string());
    let cover_class = if stable_hash_u64(&album_id) % 2 == 0 {
        "cover-a"
    } else {
        "cover-b"
    };

    Ok(Song {
        id: format!("song-{}", stable_hash(&path_str)),
        title,
        artist,
        album,
        album_id,
        duration,
        format,
        cover_class: cover_class.to_string(),
        year,
        track,
        file_path: Some(path_str),
        folder_id: Some(folder_id.to_string()),
    })
}

fn track_label(tag: Option<&lofty::tag::Tag>) -> String {
    let Some(tag) = tag else {
        return String::new();
    };

    match (tag.track(), tag.track_total()) {
        (Some(track), Some(total)) if total > 0 => format!("{track} / {total}"),
        (Some(track), _) => track.to_string(),
        _ => String::new(),
    }
}

fn is_audio_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|ext| ext.to_str()) else {
        return false;
    };

    matches!(
        ext.to_ascii_lowercase().as_str(),
        "mp3" | "flac" | "wav" | "ogg" | "aac" | "m4a" | "ape"
    )
}

fn stable_hash(input: &str) -> String {
    format!("{:016x}", stable_hash_u64(input))
}

fn stable_hash_u64(input: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_supported_audio_extensions() {
        assert!(is_audio_file(Path::new("track.mp3")));
        assert!(is_audio_file(Path::new("track.FLAC")));
        assert!(is_audio_file(Path::new("track.m4a")));
        assert!(!is_audio_file(Path::new("cover.jpg")));
        assert!(!is_audio_file(Path::new("README")));
    }

    #[test]
    fn stable_hashes_are_repeatable() {
        assert_eq!(stable_hash("same input"), stable_hash("same input"));
        assert_ne!(stable_hash("same input"), stable_hash("other input"));
    }
}
