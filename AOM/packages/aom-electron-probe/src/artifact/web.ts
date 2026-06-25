import type {
  ArtifactInspection,
  RawStaticSnapshot,
} from "@aom/protocol";
import type { StaticAnalysisAdapter } from "../types.js";
import { ElectronArtifactAdapter } from "./electron.js";

export class GenericWebArtifactAdapter implements StaticAnalysisAdapter {
  readonly adapterId = "adapter:web-artifact";
  readonly tools;
  private readonly delegate: ElectronArtifactAdapter;

  constructor(
    readonly targetId: string,
    artifactRoot: string,
  ) {
    this.delegate = new ElectronArtifactAdapter(targetId, artifactRoot);
    this.tools = this.delegate.tools;
  }

  accepts(inspection: ArtifactInspection): boolean {
    return inspection.recommendedAdapter === this.adapterId;
  }

  async collectStaticSnapshot(): Promise<RawStaticSnapshot> {
    const snapshot = await this.delegate.collectStaticSnapshot();
    return {
      ...snapshot,
      platform: "web",
      adapterId: this.adapterId,
    };
  }
}
