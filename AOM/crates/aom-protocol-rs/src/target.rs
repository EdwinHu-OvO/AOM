use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TargetPlatform {
    Electron,
    Android,
    Flutter,
    Web,
    DebugMock,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TargetLifecycle {
    AttachExisting,
    LaunchOwned,
    LaunchForHandoff,
    CopyForStaticAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TargetConnection {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lifecycle: Option<TargetLifecycle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cdp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adb_serial: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TargetDescriptor {
    pub target_id: String,
    pub platform: TargetPlatform,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection: Option<TargetConnection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub security_profile: Option<String>,
}
