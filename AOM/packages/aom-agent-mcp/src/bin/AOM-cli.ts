#!/usr/bin/env node
import { runCommand } from "../cli/commands.js";
import { helpFor } from "../cli/help.js";
import { resolveConfigPath } from "../cli/schema.js";

try {
  const rawArgs = process.argv.slice(2);
  const filePath = resolveConfigPath(rawArgs);
  const format = option(rawArgs, "-format") ?? "human";
  const result = runCommand(stripGlobalOptions(rawArgs), filePath);
  process.stdout.write(`${format === "json" ? JSON.stringify(result.data) : result.text}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${helpFor()}\n`);
  process.exitCode = 1;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function stripGlobalOptions(args: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if ((args[index] === "-file" || args[index] === "-format") && args[index + 1]) {
      index += 1;
    } else {
      result.push(args[index]!);
    }
  }
  return result;
}
