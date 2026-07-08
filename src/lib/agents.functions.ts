// ─── Multi-agent orchestrator ─────────────────────────────────────────────
// Server function that fans out to the deterministic agents in parallel and
// returns a consolidated report for a match. This is what the home page and
// dashboards call to render agent output.

import { createServerFn } from "@tanstack/react-start";
import { getMatchDataset } from "@/lib/match-data";
import { snapshotOf, detectEvents, type LiveEvent } from "@/lib/agents/live-data";
import { tacticalReport, type TacticalReport } from "@/lib/agents/tactical";
import { predictOutcome, type MatchOutcome } from "@/lib/agents/prediction";
import { retrieve, type Retrieval } from "@/lib/agents/rag";
import { buildVisualization, type VisualizationBundle } from "@/lib/agents/visualization";
import { analyseVideo, type VideoAnalysis } from "@/lib/agents/video";

export type AgentReport = {
  matchId: string;
  ok: boolean;
  live: LiveEvent[];
  tactical: TacticalReport | null;
  prediction: MatchOutcome | null;
  visualization: VisualizationBundle | null;
  rag: Retrieval | null;
  video: VideoAnalysis;
  generatedAt: number;
};

export const runAgents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const d = input as { matchId?: unknown; query?: unknown };
    if (typeof d?.matchId !== "string" || !d.matchId) throw new Error("matchId required");
    return { matchId: d.matchId, query: typeof d.query === "string" ? d.query : "" };
  })
  .handler(async ({ data }): Promise<AgentReport> => {
    const dataset = getMatchDataset(data.matchId);
    if (!dataset) {
      return {
        matchId: data.matchId,
        ok: false,
        live: [],
        tactical: null,
        prediction: null,
        visualization: null,
        rag: null,
        video: analyseVideo({ url: "" }),
        generatedAt: Date.now(),
      };
    }
    // Deterministic agents — cheap, run in parallel.
    const snapshot = snapshotOf(dataset);
    const [tactical, prediction, visualization, rag, live, video] = await Promise.all([
      Promise.resolve(tacticalReport(dataset)),
      Promise.resolve(predictOutcome(dataset)),
      Promise.resolve(buildVisualization(dataset)),
      Promise.resolve(retrieve(data.query || `${dataset.match.home.name} ${dataset.match.away.name} tactics`, 3)),
      Promise.resolve(detectEvents(undefined, snapshot)),
      Promise.resolve(analyseVideo({ url: "" })),
    ]);

    return {
      matchId: dataset.match.id,
      ok: true,
      live,
      tactical,
      prediction,
      visualization,
      rag,
      video,
      generatedAt: Date.now(),
    };
  });
