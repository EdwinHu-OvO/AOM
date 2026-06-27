import type { AnalyzerSessionConfig } from "@aom/protocol";
import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { launchElectronForHandoff } from "../analyzer/handoff.js";
import { attachElectronAnalyzer, launchElectronAnalyzer } from "../analyzer/playwright.js";
import type { PlaywrightElectronSession } from "../analyzer/playwright.js";

export interface PreparedAnalyzerConfig {
  config: AnalyzerSessionConfig;
  cleanup(): Promise<void>;
}

export async function prepareAnalyzerConfig(
  config: AnalyzerSessionConfig,
): Promise<PreparedAnalyzerConfig> {
  const copy = await copyStaticArtifact(config);
  return {
    config: copy ? { ...config, artifactLocator: copy.artifactLocator } : config,
    cleanup: async () => {
      if (copy) await rm(copy.tempRoot, { recursive: true, force: true });
    },
  };
}

export async function createRuntimeSession(
  config: AnalyzerSessionConfig,
): Promise<PlaywrightElectronSession | undefined> {
  const connection = config.target.connection;
  if (connection?.cdpUrl) {
    return attachElectronAnalyzer({
      targetId: config.target.targetId,
      cdpUrl: connection.cdpUrl,
    });
  }
  if (connection?.lifecycle === "attach_existing") {
    throw new Error("attach_existing_requires_cdp_url");
  }
  if (connection?.lifecycle === "copy_for_static_analysis") {
    return undefined;
  }
  if (connection?.lifecycle === "launch_for_handoff") {
    if (!config.executablePath) throw new Error("launch_for_handoff_requires_executable_path");
    return launchElectronForHandoff({
      targetId: config.target.targetId,
      executablePath: config.executablePath,
    });
  }
  if (!config.executablePath) return undefined;
  return launchElectronAnalyzer({
    targetId: config.target.targetId,
    executablePath: config.executablePath,
  });
}

async function copyStaticArtifact(
  config: AnalyzerSessionConfig,
): Promise<{ artifactLocator: string; tempRoot: string } | undefined> {
  const lifecycle = config.target.connection?.lifecycle;
  if (
    !config.artifactLocator
    || !["attach_existing", "copy_for_static_analysis", "launch_for_handoff"].includes(
      lifecycle ?? "",
    )
  ) {
    return undefined;
  }
  await stat(config.artifactLocator);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "aom-static-copy-"));
  const artifactLocator = path.join(tempRoot, path.basename(config.artifactLocator));
  await cp(config.artifactLocator, artifactLocator, {
    recursive: true,
    errorOnExist: true,
    force: false,
    verbatimSymlinks: true,
  });
  return { artifactLocator, tempRoot };
}
