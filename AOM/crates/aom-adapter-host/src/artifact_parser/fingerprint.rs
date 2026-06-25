use aom_protocol_rs::{ArtifactDetectionEvidence, RuntimeCandidate, WebRuntimeFamily};
use std::collections::BTreeMap;

pub struct FingerprintResult {
    pub candidates: Vec<RuntimeCandidate>,
    pub recommended_adapter: Option<String>,
    pub evidence: Vec<ArtifactDetectionEvidence>,
}

pub fn fingerprint(locators: &[String], sampled_text: &str) -> FingerprintResult {
    let corpus = format!("{}\n{}", locators.join("\n"), sampled_text).to_ascii_lowercase();
    let mut detector = Detector::default();

    detector.signal(
        WebRuntimeFamily::Electron,
        0.65,
        "path",
        "resources/app.asar",
        &corpus,
    );
    detector.signal(
        WebRuntimeFamily::Electron,
        0.45,
        "symbol",
        "electron framework",
        &corpus,
    );
    detector.signal(
        WebRuntimeFamily::Electron,
        0.35,
        "path",
        "electron.exe",
        &corpus,
    );
    detector.signal(WebRuntimeFamily::Cef, 0.8, "library", "libcef", &corpus);
    detector.signal(WebRuntimeFamily::Cef, 0.25, "resource", "cef.pak", &corpus);
    detector.signal(
        WebRuntimeFamily::WebView2,
        0.8,
        "library",
        "webview2loader",
        &corpus,
    );
    detector.signal(
        WebRuntimeFamily::WebView2,
        0.8,
        "process",
        "msedgewebview2",
        &corpus,
    );
    detector.signal(WebRuntimeFamily::Nwjs, 0.8, "library", "nw.dll", &corpus);
    detector.signal(
        WebRuntimeFamily::Nwjs,
        0.75,
        "archive",
        "package.nw",
        &corpus,
    );
    detector.signal(WebRuntimeFamily::Tauri, 0.8, "symbol", "__tauri__", &corpus);
    detector.signal(
        WebRuntimeFamily::Tauri,
        0.65,
        "metadata",
        "tauri.conf.json",
        &corpus,
    );
    detector.signal(
        WebRuntimeFamily::QtWebEngine,
        0.9,
        "library",
        "qt6webenginecore",
        &corpus,
    );
    detector.signal(
        WebRuntimeFamily::QtWebEngine,
        0.9,
        "library",
        "qt5webenginecore",
        &corpus,
    );
    detector.generic_web_signals(&corpus);
    detector.finish()
}

#[derive(Default)]
struct Detector {
    scores: BTreeMap<String, (WebRuntimeFamily, f32)>,
    evidence: Vec<ArtifactDetectionEvidence>,
}

impl Detector {
    fn signal(
        &mut self,
        runtime: WebRuntimeFamily,
        weight: f32,
        kind: &str,
        needle: &str,
        corpus: &str,
    ) {
        if !corpus.contains(needle) {
            return;
        }
        let key = runtime_key(&runtime).to_string();
        let entry = self.scores.entry(key).or_insert((runtime, 0.0));
        entry.1 = (entry.1 + weight).min(0.99);
        self.evidence.push(ArtifactDetectionEvidence {
            evidence_id: format!("evidence:artifact:fingerprint:{}", self.evidence.len() + 1),
            detector: "web-runtime-fingerprint".to_string(),
            kind: kind.to_string(),
            value: needle.to_string(),
            locator: None,
        });
    }

    fn generic_web_signals(&mut self, corpus: &str) {
        for (needle, weight) in [
            (".html", 0.2),
            (".js", 0.15),
            (".css", 0.1),
            ("v8_context_snapshot", 0.15),
            ("chrome_100_percent.pak", 0.15),
        ] {
            self.signal(
                WebRuntimeFamily::GenericWeb,
                weight,
                "web_artifact",
                needle,
                corpus,
            );
        }
    }

    fn finish(self) -> FingerprintResult {
        let mut candidates: Vec<_> = self
            .scores
            .into_values()
            .map(|(runtime, confidence)| RuntimeCandidate {
                runtime,
                confidence: (confidence * 100.0).round() / 100.0,
            })
            .collect();
        candidates.sort_by(|left, right| {
            right
                .confidence
                .partial_cmp(&left.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let recommended_adapter = candidates
            .first()
            .filter(|candidate| candidate.confidence >= 0.35)
            .map(|candidate| adapter_for(&candidate.runtime).to_string());
        if candidates.is_empty() {
            candidates.push(RuntimeCandidate {
                runtime: WebRuntimeFamily::Unknown,
                confidence: 0.0,
            });
        }
        FingerprintResult {
            candidates,
            recommended_adapter,
            evidence: self.evidence,
        }
    }
}

fn runtime_key(runtime: &WebRuntimeFamily) -> &'static str {
    match runtime {
        WebRuntimeFamily::Electron => "electron",
        WebRuntimeFamily::Cef => "cef",
        WebRuntimeFamily::WebView2 => "webview2",
        WebRuntimeFamily::Nwjs => "nwjs",
        WebRuntimeFamily::Tauri => "tauri",
        WebRuntimeFamily::QtWebEngine => "qt-web-engine",
        WebRuntimeFamily::GenericWeb => "generic-web",
        WebRuntimeFamily::Unknown => "unknown",
    }
}

fn adapter_for(runtime: &WebRuntimeFamily) -> &'static str {
    match runtime {
        WebRuntimeFamily::Electron => "adapter:electron-artifact",
        WebRuntimeFamily::Cef => "adapter:cef-artifact",
        WebRuntimeFamily::WebView2 => "adapter:webview2-artifact",
        WebRuntimeFamily::Nwjs => "adapter:nwjs-artifact",
        WebRuntimeFamily::Tauri => "adapter:tauri-artifact",
        WebRuntimeFamily::QtWebEngine => "adapter:qt-web-engine-artifact",
        WebRuntimeFamily::GenericWeb => "adapter:web-artifact",
        WebRuntimeFamily::Unknown => "adapter:generic-binary",
    }
}
