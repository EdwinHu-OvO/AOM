import { auditLevels, featureNames, logLevels } from "./schema.js";

export function helpFor(scope?: string): string {
  switch (scope) {
    case "-feature":
    case "feature":
      return featureHelp();
    case "-log":
    case "log":
      return logHelp();
    case "-config":
    case "config":
      return configHelp();
    default:
      return rootHelp();
  }
}

function rootHelp(): string {
  return [
    "AOM-cli controls AOM feature flags and logging configuration only.",
    "",
    "Usage:",
    "  ./AOM-cli -feature -list|-show|-enable|-disable|-set ...",
    "  ./AOM-cli -log -show|-level|-set|-audit-level ...",
    "  ./AOM-cli -config -show|-validate|-path",
    "",
    "Global options:",
    "  -file <path>          Use a config file instead of AOM_CONFIG/default.",
    "  -format human|json    Output format. Defaults to human.",
    "  -help                 Show this help.",
    "",
    "Layer help:",
    "  ./AOM-cli -feature -help",
    "  ./AOM-cli -log -help",
    "  ./AOM-cli -config -help",
    "",
    "Boundary:",
    "  This CLI does not manage sessions, launch targets, run analyzers, or invoke actions.",
  ].join("\n");
}

function featureHelp(): string {
  return [
    "Feature configuration commands:",
    "",
    "  ./AOM-cli -feature -list",
    "  ./AOM-cli -feature -show <feature>",
    "  ./AOM-cli -feature -enable <feature>",
    "  ./AOM-cli -feature -disable <feature>",
    "  ./AOM-cli -feature -set <feature.key> <value>",
    "",
    "Examples:",
    "  ./AOM-cli -feature -enable dynamic_call_chain",
    "  ./AOM-cli -feature -set dynamic_call_chain.max_steps 4",
    "  ./AOM-cli -feature -set llm_capability_recognizer.model qwen3.6:35b",
    "",
    "Known features:",
    `  ${featureNames.join(", ")}`,
  ].join("\n");
}

function logHelp(): string {
  return [
    "Logging configuration commands:",
    "",
    "  ./AOM-cli -log -show",
    "  ./AOM-cli -log -level <level>",
    "  ./AOM-cli -log -set <module> <level>",
    "  ./AOM-cli -log -audit-level <level>",
    "",
    `Log levels: ${logLevels.join(", ")}`,
    `Audit levels: ${auditLevels.join(", ")}`,
    "",
    "Examples:",
    "  ./AOM-cli -log -level info",
    "  ./AOM-cli -log -set orchestration debug",
    "  ./AOM-cli -log -audit-level verbose",
  ].join("\n");
}

function configHelp(): string {
  return [
    "Config inspection commands:",
    "",
    "  ./AOM-cli -config -path",
    "  ./AOM-cli -config -show",
    "  ./AOM-cli -config -validate",
    "",
    "Use -file <path> or AOM_CONFIG to select a non-default config file.",
  ].join("\n");
}
