use crate::error::{AppError, CommandResult};
use rusqlite::Connection;

pub fn list_watched_folders(conn: &Connection) -> CommandResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT id, path FROM folders")?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
