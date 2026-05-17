use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    #[serde(default = "default_settings")]
    pub settings: Value,
}

fn default_settings() -> Value {
    json!({})
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSourceInput {
    #[serde(rename = "type")]
    pub kind: String,
    pub value: String,
    pub name: Option<String>,
}
