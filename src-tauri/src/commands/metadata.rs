use crate::{
    db::repository,
    error::CommandResult,
    model::library::{MetadataPatch, Song, UpdateMetadataResponse},
    state::{with_db, AppState},
};
use tauri::State;

#[tauri::command]
pub fn get_song_metadata(
    song_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Option<Song>> {
    with_db(&state, |conn| repository::get_song(conn, &song_id))
}

#[tauri::command]
pub fn update_metadata(
    song_id: String,
    data: MetadataPatch,
    state: State<'_, AppState>,
) -> CommandResult<UpdateMetadataResponse> {
    let song = with_db(&state, |conn| repository::get_song(conn, &song_id))?
        .ok_or_else(|| crate::error::AppError::not_found("song not found"))?;

    if let Some(file_path) = &song.file_path {
        use lofty::probe::Probe;
        use lofty::file::TaggedFileExt;
        use lofty::tag::{Tag, TagExt, Accessor};

        let mut tagged_file = Probe::open(file_path)?.read()?;
        
        let tag = match tagged_file.primary_tag_mut() {
            Some(t) => t,
            None => {
                if let Some(first_tag) = tagged_file.first_tag_mut() {
                    first_tag
                } else {
                    let tag_type = tagged_file.primary_tag_type();
                    tagged_file.insert_tag(Tag::new(tag_type));
                    tagged_file.primary_tag_mut().unwrap()
                }
            }
        };

        if let Some(title) = &data.title {
            tag.set_title(title.clone());
        }
        if let Some(artist) = &data.artist {
            tag.set_artist(artist.clone());
        }
        if let Some(album) = &data.album {
            tag.set_album(album.clone());
        }
        if let Some(year) = data.year {
            tag.set_year(year as u32);
        }
        if let Some(track) = &data.track {
            if let Ok(num) = track.parse::<u32>() {
                tag.set_track(num);
            }
        }
        
        tag.save_to_path(file_path, lofty::config::WriteOptions::default())?;
    }

    with_db(&state, |conn| {
        let updated_song = repository::update_song_metadata(conn, &song_id, data)?;
        Ok(UpdateMetadataResponse {
            success: true,
            song: updated_song,
        })
    })
}

#[tauri::command]
pub async fn match_musicbrainz(
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
) -> CommandResult<Option<MetadataPatch>> {
    let mut query_parts = Vec::new();
    if let Some(t) = title {
        if !t.trim().is_empty() {
            query_parts.push(format!("recording:\"{}\"", t.trim()));
        }
    }
    if let Some(a) = artist {
        if !a.trim().is_empty() {
            query_parts.push(format!("artist:\"{}\"", a.trim()));
        }
    }
    if let Some(al) = album {
        if !al.trim().is_empty() {
            query_parts.push(format!("release:\"{}\"", al.trim()));
        }
    }

    if query_parts.is_empty() {
        return Ok(None);
    }

    let query = query_parts.join(" AND ");
    let encoded_query = urlencoding::encode(&query);
    let url = format!("https://musicbrainz.org/ws/2/recording?query={}&fmt=json&limit=1", encoded_query);

    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("User-Agent", "iplayer/0.1.0 ( feifan00x@gmail.com )")
        .send()
        .await?;

    if !res.status().is_success() {
        return Ok(None);
    }

    let data: serde_json::Value = res.json().await?;
    let recordings = data.get("recordings").and_then(|r| r.as_array());

    if let Some(recs) = recordings {
        if let Some(rec) = recs.first() {
            let mut patch = MetadataPatch {
                title: None,
                artist: None,
                album: None,
                year: None,
                track: None,
                cover_url: None,
            };

            if let Some(title) = rec.get("title").and_then(|t| t.as_str()) {
                patch.title = Some(title.to_string());
            }

            if let Some(artist_credits) = rec.get("artist-credit").and_then(|a| a.as_array()) {
                if let Some(first_artist) = artist_credits.first() {
                    if let Some(name) = first_artist.get("name").and_then(|n| n.as_str()) {
                        patch.artist = Some(name.to_string());
                    }
                }
            }

            if let Some(releases) = rec.get("releases").and_then(|r| r.as_array()) {
                if let Some(first_release) = releases.first() {
                    if let Some(title) = first_release.get("title").and_then(|t| t.as_str()) {
                        patch.album = Some(title.to_string());
                    }
                    if let Some(id) = first_release.get("id").and_then(|id| id.as_str()) {
                        patch.cover_url = Some(format!("https://coverartarchive.org/release/{}/front", id));
                    }
                    if let Some(date) = first_release.get("date").and_then(|d| d.as_str()) {
                        if let Ok(year) = date.split('-').next().unwrap_or("").parse::<i32>() {
                            patch.year = Some(year);
                        }
                    }
                    if let Some(media) = first_release.get("media").and_then(|m| m.as_array()) {
                        if let Some(first_media) = media.first() {
                            if let Some(tracks) = first_media.get("track").and_then(|t| t.as_array()) {
                                if let Some(first_track) = tracks.first() {
                                    if let Some(num) = first_track.get("number").and_then(|n| n.as_str()) {
                                        patch.track = Some(num.to_string());
                                    } else if let Some(num) = first_track.get("number").and_then(|n| n.as_i64()) {
                                        patch.track = Some(num.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return Ok(Some(patch));
        }
    }

    Ok(None)
}
