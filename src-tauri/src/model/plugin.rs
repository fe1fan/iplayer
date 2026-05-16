use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source: String,
    pub enabled: bool,
    pub trust: String,
    pub hooks: Vec<String>,
    pub description: String,
    pub config_type: Option<String>,
}
