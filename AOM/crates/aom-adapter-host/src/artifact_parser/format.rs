use aom_protocol_rs::ArtifactContainerType;
use std::path::Path;

pub struct FormatDetection {
    pub container_type: ArtifactContainerType,
    pub architecture: Option<String>,
    pub reason: String,
}

pub fn detect_format(path: &Path, bytes: &[u8]) -> FormatDetection {
    if path.is_dir() {
        let is_app = path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("app"));
        return detection(
            if is_app {
                ArtifactContainerType::MacAppBundle
            } else {
                ArtifactContainerType::Directory
            },
            None,
            "filesystem directory",
        );
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "asar" {
        return detection(ArtifactContainerType::Asar, None, "asar extension");
    }
    if extension == "apk" {
        return detection(ArtifactContainerType::Apk, None, "apk extension");
    }
    if bytes.starts_with(b"MZ") {
        return detection(
            ArtifactContainerType::Pe,
            pe_architecture(bytes),
            "MZ/PE magic",
        );
    }
    if bytes.starts_with(b"\x7fELF") {
        let app_image = bytes.get(8..11).is_some_and(|value| value == b"AI\x02");
        return detection(
            if app_image {
                ArtifactContainerType::AppImage
            } else {
                ArtifactContainerType::Elf
            },
            elf_architecture(bytes),
            if app_image {
                "ELF with AppImage magic"
            } else {
                "ELF magic"
            },
        );
    }
    if let Some(architecture) = mach_architecture(bytes) {
        return detection(
            ArtifactContainerType::MachO,
            Some(architecture),
            "Mach-O magic",
        );
    }
    if bytes.starts_with(b"PK\x03\x04") {
        return detection(ArtifactContainerType::Zip, None, "ZIP magic");
    }
    detection(
        ArtifactContainerType::Unknown,
        None,
        "no known container magic",
    )
}

fn detection(
    container_type: ArtifactContainerType,
    architecture: Option<String>,
    reason: &str,
) -> FormatDetection {
    FormatDetection {
        container_type,
        architecture,
        reason: reason.to_string(),
    }
}

fn pe_architecture(bytes: &[u8]) -> Option<String> {
    let offset = u32::from_le_bytes(bytes.get(0x3c..0x40)?.try_into().ok()?) as usize;
    if bytes.get(offset..offset + 4)? != b"PE\0\0" {
        return None;
    }
    match u16::from_le_bytes(bytes.get(offset + 4..offset + 6)?.try_into().ok()?) {
        0x014c => Some("x86".to_string()),
        0x8664 => Some("x86_64".to_string()),
        0xaa64 => Some("aarch64".to_string()),
        machine => Some(format!("pe-machine-{machine:#06x}")),
    }
}

fn elf_architecture(bytes: &[u8]) -> Option<String> {
    let little_endian = bytes.get(5).copied()? == 1;
    let raw: [u8; 2] = bytes.get(18..20)?.try_into().ok()?;
    let machine = if little_endian {
        u16::from_le_bytes(raw)
    } else {
        u16::from_be_bytes(raw)
    };
    match machine {
        0x03 => Some("x86".to_string()),
        0x3e => Some("x86_64".to_string()),
        0x28 => Some("arm".to_string()),
        0xb7 => Some("aarch64".to_string()),
        value => Some(format!("elf-machine-{value:#06x}")),
    }
}

fn mach_architecture(bytes: &[u8]) -> Option<String> {
    let magic: [u8; 4] = bytes.get(0..4)?.try_into().ok()?;
    match magic {
        [0xfe, 0xed, 0xfa, 0xce] | [0xce, 0xfa, 0xed, 0xfe] => Some("mach-o-32".to_string()),
        [0xfe, 0xed, 0xfa, 0xcf] | [0xcf, 0xfa, 0xed, 0xfe] => Some("mach-o-64".to_string()),
        [0xca, 0xfe, 0xba, 0xbe] | [0xbe, 0xba, 0xfe, 0xca] => Some("universal".to_string()),
        _ => None,
    }
}
