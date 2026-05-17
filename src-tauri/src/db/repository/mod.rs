pub mod albums;
pub mod folders;
pub mod import;
pub mod liked;
pub mod playlists;
pub mod songs;

pub use albums::list_albums;
pub use folders::list_watched_folders;
pub use import::import_scanned_songs;
pub use liked::toggle_like;
pub use playlists::{
    add_songs_to_playlist, create_playlist, delete_playlist, list_playlists,
    remove_song_from_playlist, rename_playlist,
};
pub use songs::{get_song, list_songs, search_songs, update_song_metadata};

#[cfg(test)]
mod tests;
