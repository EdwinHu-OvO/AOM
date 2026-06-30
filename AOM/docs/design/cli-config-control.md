# AOM CLI Config Control

## Goal

`AOM-cli` is the local control surface for AOM feature configuration and logging levels.

It deliberately does not launch apps, attach sessions, run analysis, invoke capabilities, or act as a
workflow scripting interface. Those responsibilities stay with MCP, runtime adapters, Analysis
Layer, Capability Layer, and Console.

## Command Shape

```text
./AOM-cli -function -optional_subfunc [-parameters]
```

Current functions:

- `-feature`: list, inspect, enable, disable, or set feature options.
- `-log`: inspect or set global/module log levels and audit verbosity.
- `-config`: show config path, redacted config, or validation result.
- `-init`: print a setup guide, check baseline config sections, or merge safe defaults.
- `-help`: top-level help. Each function also supports `-help`.

Global options:

- `-file <path>` selects a config file. Otherwise AOM uses `AOM_CONFIG` or the default
  `AOM/aom.config.json`.
- `-format human|json` controls output shape.

## Examples

```text
./AOM-cli -feature -list
./AOM-cli -feature -enable dynamic_call_chain
./AOM-cli -feature -set dynamic_call_chain.max_steps 4
./AOM-cli -feature -set llm_capability_recognizer.model qwen3.6:35b

./AOM-cli -log -level info
./AOM-cli -log -set orchestration debug
./AOM-cli -log -audit-level verbose

./AOM-cli -config -show
./AOM-cli -config -validate

./AOM-cli -init
./AOM-cli -init -check
./AOM-cli -init -write-default
```

`llm_capability_recognizer` is bridged to the existing `capabilityRecognizer` config so current MCP
startup behavior remains compatible while AOM grows a more general `features` namespace.

`-init -write-default` merges baseline `features` and `logging` sections into the selected config
file. It must preserve unknown fields and local secrets; it is not a project bootstrapper or runtime
launcher.

## Boundaries

- The CLI may read and update config files only.
- It must preserve unknown config keys and redact secrets on display.
- It is not a debugger, session manager, target launcher, analyzer runner, action executor, or demo
  script runner.
