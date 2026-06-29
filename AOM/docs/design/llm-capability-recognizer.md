# LLM Capability Recognizer

## Goal

Use a small local or private model to improve capability discovery on real apps whose UI does not
match the current deterministic MVP recipes.

The recognizer is a candidate generator. It is not an execution engine and does not replace AOM's
object graph, action runtime, verification, or future Safety Gateway.

## Configuration

AOM reads `AOM/aom.config.json` when the MCP server starts. The path can be overridden with
`AOM_CONFIG`.

Default config:

```json
{
  "capabilityRecognizer": {
    "enabled": false,
    "provider": "openai_compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "qwen3.6:35b",
    "apiKey": "",
    "apiKeyEnv": "AOM_LLM_API_KEY",
    "headers": {},
    "timeoutMs": 15000,
    "temperature": 0,
    "topP": 1,
    "maxTokens": 1200,
    "maxCandidates": 8,
    "minConfidence": 0.5,
    "schemaRepairAttempts": 1
  }
}
```

To enable a local OpenAI-compatible model, set `enabled` to `true` and run a compatible endpoint.
`baseUrl` should be the API root, for example `https://proxy.example/v1`; AOM appends
`/chat/completions`.

Authentication options:

- `apiKey`: inline key; AOM sends `Authorization: Bearer <apiKey>`.
- `apiKeyEnv`: environment variable name; AOM reads the key from that variable.
- `headers`: additional headers. Values may reference environment variables, for example
  `{ "x-api-key": "$AOM_LLM_API_KEY" }`.

For compatibility with early configs, if `apiKeyEnv` does not name an existing environment variable
and does not look like an environment variable name, AOM treats it as an inline key.

## Flow

```text
Rust AnalysisService graph/context pack
  -> compact recognition pack
  -> OpenAI-compatible /chat/completions
  -> CapabilityCandidate[]
  -> deterministic validator
  -> optional one-pass schema repair when all candidates fail validation
  -> ExecutableCapability[]
```

`analyzeSession` waits for the recognizer call to finish when the recognizer is enabled. The
agent-facing `ready` signal is therefore split into explicit readiness fields instead of one
ambiguous boolean:

- `runtimeReady`: Electron/CDP runtime is connected and a raw snapshot can be collected.
- `analysisReady`: Rust AnalysisService has produced graph, context pack, data-flow summary, and
  deterministic capabilities.
- `semanticReady`: external LLM recognition has completed with success, validation rejection, or
  error.
- `capabilityReady`: at least one executable capability is available for current-screen planning.

This distinction matters for real apps: semantic recognition may be complete while still producing
zero accepted capabilities. In that state AOM should expose graph/views/data-flow for audit and
manual structured actions, but higher-level agents should not treat the app as capability-ready.

## Validation Rules

LLM candidates are accepted only when:

- the candidate references an existing current-screen `targetViewId` or exact `targetLabel`
- the target is an AOM `view`
- the target is contained by the current screen
- the requested action is supported by the target view
- the target has a `rawReference`
- `set_text` candidates declare an input slot
- confidence is at or above `minConfidence`

The model must not invent DOM selectors, CDP commands, coordinates, internal APIs, or hidden state.

The parser accepts a small compatibility surface for common OpenAI-compatible model responses:
`candidates`, `capabilities`, `actions`, or a root array are supported. Candidate field aliases such
as `capability`, `capabilityName`, `target_view_id`, `target_label`, `score`, `probability`, `why`,
and `explanation` are normalized before validation. Validation remains strict after normalization.

If every candidate is rejected and `schemaRepairAttempts` is greater than zero, AOM sends the
previous model output plus validator errors back to the same endpoint once. The repair request is
only allowed to fix schema/field issues against the same recognition pack; it is not allowed to
invent new targets or facts. The returned candidates are validated again before they can become
`ExecutableCapability` objects.

## Bilibili Lessons

The first Bilibili trial exposed two deterministic gaps:

- Unicode labels were normalized away when producing stable IDs, causing Chinese view collisions.
- Raw runtime snapshots exposed useful nodes such as `我的`, but the Agent could not map those raw
  nodes back to graph-backed AOM views.

The current implementation fixes both:

- `stable_id.normalize()` keeps Unicode alphanumeric characters.
- Context views now expose `rawReference`.
- `aom.invoke_view` accepts `rawId` as a graph-validated fallback.

LLM recognition is layered on top of these fixes. It helps identify generic capabilities such as
`open_profile`, `search_content`, `switch_tab`, `open_video`, and `play_media`; it does not make raw
DOM or CDP directly available to Agents.

The 2026-06-27 Bilibili audit also showed a second-stage failure mode: the proxy/model could be
called successfully, but returned six candidates that failed validation because required candidate
fields were missing. AOM now records this as `semanticReady: true` and `capabilityReady: false`, and
the audit log keeps the recognizer rejection reasons so the prompt/parser/validator boundary can be
debugged without pretending the app is ready for autonomous capability execution.
