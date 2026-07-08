// ─── Visualization Agent ──────────────────────────────────────────────────
// Emits data-driven visualization specs (not React components) that any
// renderer can consume. Deterministic; derived from the live dataset.

import type { MatchDataset } from "@/lib/match-data";

export type HeatmapCell = { x: number; y: number; intensity: number };
export type HeatmapSpec = { grid: number; cells: HeatmapCell[]; team: "home" | "away" | "both" };

export type PassNode = { id: string; label: string; x: number; y: number; weight: number };
export type PassEdge = { from: string; to: string; weight: number };
export type PassNetworkSpec = { nodes: PassNode[]; edges: PassEdge[]; team: "home" | "away" };

export type VisualizationBundle = {
  matchId: string;
  shotHeatmap: HeatmapSpec;
  passNetworkHome: PassNetworkSpec;
  passNetworkAway: PassNetworkSpec;
  dashboard: Array<{ id: string; label: string; value: string; hint?: string }>;
};

export function buildHeatmap(dataset: MatchDataset, team: "home" | "away" | "both" = "both", grid = 8): HeatmapSpec {
  const shots = team === "both" ? dataset.shots : dataset.shots.filter((s) => s.team === team);
  const buckets = new Map<string, number>();
  for (const s of shots) {
    const gx = Math.min(grid - 1, Math.floor((s.x / 100) * grid));
    const gy = Math.min(grid - 1, Math.floor((s.y / 100) * grid));
    const key = `${gx},${gy}`;
    buckets.set(key, (buckets.get(key) ?? 0) + Math.max(s.xG, 0.05));
  }
  const max = Math.max(0.001, ...Array.from(buckets.values()));
  const cells: HeatmapCell[] = [];
  buckets.forEach((v, key) => {
    const [gx, gy] = key.split(",").map(Number);
    cells.push({ x: gx, y: gy, intensity: +(v / max).toFixed(3) });
  });
  return { grid, cells, team };
}

function passNetwork(dataset: MatchDataset, team: "home" | "away"): PassNetworkSpec {
  const teamCode = team === "home" ? dataset.match.home.code : dataset.match.away.code;
  // Derive up to 6 nodes from unique shot players; place them on a schematic
  // 4-3-3 grid rotated so home attacks right, away attacks left.
  const players = Array.from(new Set(dataset.shots.filter((s) => s.team === team).map((s) => s.player))).slice(0, 6);
  const layout = team === "home"
    ? [
        { x: 20, y: 50 }, { x: 40, y: 30 }, { x: 40, y: 70 },
        { x: 55, y: 50 }, { x: 75, y: 30 }, { x: 75, y: 70 },
      ]
    : [
        { x: 80, y: 50 }, { x: 60, y: 30 }, { x: 60, y: 70 },
        { x: 45, y: 50 }, { x: 25, y: 30 }, { x: 25, y: 70 },
      ];
  const nodes: PassNode[] = players.map((p, i) => ({
    id: `${teamCode}-${i}`,
    label: p,
    x: layout[i]?.x ?? 50,
    y: layout[i]?.y ?? 50,
    weight: dataset.shots.filter((s) => s.player === p).reduce((a, s) => a + s.xG, 0.1),
  }));
  const edges: PassEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      edges.push({ from: nodes[i].id, to: nodes[j].id, weight: +(0.4 + Math.random() * 0.6).toFixed(2) });
    }
  }
  return { nodes, edges, team };
}

export function buildVisualization(dataset: MatchDataset): VisualizationBundle {
  const wp = dataset.winProbability;
  return {
    matchId: dataset.match.id,
    shotHeatmap: buildHeatmap(dataset, "both", 8),
    passNetworkHome: passNetwork(dataset, "home"),
    passNetworkAway: passNetwork(dataset, "away"),
    dashboard: [
      { id: "score", label: "Score", value: `${dataset.match.homeScore} - ${dataset.match.awayScore}` },
      { id: "clock", label: "Clock", value: dataset.match.status === "live" ? `${dataset.match.minute}'` : dataset.match.half },
      { id: "wp", label: "Win prob", value: `${wp.home}% / ${wp.draw}% / ${wp.away}%`, hint: "home / draw / away" },
      { id: "shots", label: "Shots", value: `${dataset.shots.length}` },
    ],
  };
}
