export type ArtifactContainerType =
  | "directory"
  | "mac_app_bundle"
  | "pe"
  | "mach_o"
  | "elf"
  | "zip"
  | "asar"
  | "apk"
  | "app_image"
  | "unknown";

export type WebRuntimeFamily =
  | "electron"
  | "cef"
  | "web_view2"
  | "nwjs"
  | "tauri"
  | "qt_web_engine"
  | "generic_web"
  | "unknown";

export interface RuntimeCandidate {
  runtime: WebRuntimeFamily;
  confidence: number;
}

export interface ArtifactDetectionEvidence {
  evidenceId: string;
  detector: string;
  kind: string;
  value: string;
  locator?: string;
}

export interface ArtifactInspection {
  inspectionId: string;
  inputLocator: string;
  containerType: ArtifactContainerType;
  architecture?: string;
  runtimeCandidates: RuntimeCandidate[];
  recommendedAdapter?: string;
  evidence: ArtifactDetectionEvidence[];
}
