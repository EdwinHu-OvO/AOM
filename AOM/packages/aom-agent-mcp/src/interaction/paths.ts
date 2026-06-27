import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export function resolveLaunchExecutable(input: {
  executablePath?: string;
  appPath?: string;
}): string {
  return resolveLaunchTarget(input).executablePath;
}

export function resolveLaunchTarget(input: {
  executablePath?: string;
  appPath?: string;
}): { executablePath: string; artifactLocator?: string } {
  if (input.appPath) {
    return { executablePath: resolveAppPath(input.appPath), artifactLocator: input.appPath };
  }
  const executablePath = input.executablePath ?? defaultPlateRunExecutable();
  const artifactLocator = inferMacAppRoot(executablePath);
  return { executablePath, ...(artifactLocator ? { artifactLocator } : {}) };
}

function resolveAppPath(appPath: string): string {
  const macosDir = path.join(appPath, "Contents", "MacOS");
  const entries = readdirSync(macosDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(macosDir, entry.name));
  if (entries.length === 0) throw new Error(`app_executable_not_found: ${appPath}`);
  return entries[0]!;
}

function defaultPlateRunExecutable(): string {
  if (process.env.AOM_TARGET_APP_EXECUTABLE) return process.env.AOM_TARGET_APP_EXECUTABLE;
  const relative = "targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun";
  const candidates = [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), "..", relative),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1]!;
}

function inferMacAppRoot(executablePath: string): string | undefined {
  const marker = ".app/Contents/MacOS/";
  const index = executablePath.indexOf(marker);
  if (index === -1) return undefined;
  return executablePath.slice(0, index + ".app".length);
}
