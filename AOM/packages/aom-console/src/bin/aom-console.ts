#!/usr/bin/env node
import { renderAudit } from "../audit.js";

const args = process.argv.slice(2);
const command = args[0] ?? "audit";

if (command !== "audit") {
  console.error(`unsupported command: ${command}`);
  process.exit(1);
}

const options: { file?: string; limit?: number; json?: boolean } = {
  json: args.includes("--json"),
};
const file = option("--file");
const limit = numberOption("--limit");
if (file) options.file = file;
if (limit !== undefined) options.limit = limit;

console.log(renderAudit(options));

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberOption(name: string): number | undefined {
  const value = option(name);
  return value === undefined ? undefined : Number(value);
}
