use aom_adapter_host::{AdapterHost, ArtifactParser};
use aom_protocol_rs::{ArtifactContainerType, WebRuntimeFamily};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

struct TempFixture {
    root: PathBuf,
}

impl TempFixture {
    fn new(name: &str) -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aom-{name}-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        Self { root }
    }

    fn path(&self) -> &Path {
        &self.root
    }
}

impl Drop for TempFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn parser_recognizes_pe_architecture_from_magic() {
    let fixture = TempFixture::new("pe");
    let binary = fixture.path().join("unknown-app.exe");
    let mut bytes = vec![0_u8; 256];
    bytes[0..2].copy_from_slice(b"MZ");
    bytes[0x3c..0x40].copy_from_slice(&(0x80_u32).to_le_bytes());
    bytes[0x80..0x84].copy_from_slice(b"PE\0\0");
    bytes[0x84..0x86].copy_from_slice(&(0x8664_u16).to_le_bytes());
    fs::write(&binary, bytes).unwrap();

    let inspection = ArtifactParser.inspect(&binary).unwrap();

    assert_eq!(inspection.container_type, ArtifactContainerType::Pe);
    assert_eq!(inspection.architecture.as_deref(), Some("x86_64"));
    assert_eq!(
        inspection.runtime_candidates[0].runtime,
        WebRuntimeFamily::Unknown
    );
}

#[test]
fn parser_routes_electron_layout_to_electron_adapter() {
    let fixture = TempFixture::new("electron");
    let resources = fixture.path().join("resources");
    fs::create_dir_all(&resources).unwrap();
    fs::write(resources.join("app.asar"), b"compiled application").unwrap();
    fs::write(fixture.path().join("electron.exe"), b"MZ Electron").unwrap();
    fs::write(fixture.path().join("index.html"), b"<html></html>").unwrap();

    let inspection = ArtifactParser.inspect(fixture.path()).unwrap();

    assert_eq!(inspection.container_type, ArtifactContainerType::Directory);
    assert_eq!(
        inspection.runtime_candidates[0].runtime,
        WebRuntimeFamily::Electron
    );
    assert_eq!(
        inspection.recommended_adapter.as_deref(),
        Some("adapter:electron-artifact")
    );
}

#[test]
fn host_parser_classifies_compiled_target_as_generic_web() {
    let target_dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../targetAPP/dist");
    let inspection = AdapterHost::default()
        .inspect_artifact(target_dist)
        .unwrap();

    assert_eq!(inspection.container_type, ArtifactContainerType::Directory);
    assert_eq!(
        inspection.runtime_candidates[0].runtime,
        WebRuntimeFamily::GenericWeb
    );
    assert_eq!(
        inspection.recommended_adapter.as_deref(),
        Some("adapter:web-artifact")
    );
}
