// ─── Live Data Agent ──────────────────────────────────────────────────────
// Detects match events by diffing consecutive fixture snapshots. Pure fn,
// stateless — caller owns snapshot history. Emits typed events for goals,
// score changes, kickoffs, halftime, full-time, big-xG chances, and
// momentum swings.

import type { MatchDataset, ShotEvent } from "@/lib/match-data";

export type LiveEvent =
  | { type: "kickoff"; matchId: string; at: number }
  | { type: "goal"; matchId: string; team: "home" | "away"; scorer?: string; minute: number; xG?: number }
  | { type: "half-time"; matchId: string; minute: number }
  | { type: "full-time"; matchId: string; minute: number; final: string }
  | { type: "big-chance"; matchId: string; team: "home" | "away"; player: string; xG: number; minute: number }
  | { type: "momentum-swing"; matchId: string; from: "home" | "away" | "neutral"; to: "home" | "away"; magnitude: number };

export type FixtureSnapshot = {
  matchId: string;
  minute: number;
  status: "upcoming" | "live" | "finished";
  homeScore: number;
  awayScore: number;
  half: string;
  shots: ShotEvent[];
  momentum: number[];
};

export function snapshotOf(dataset: MatchDataset): FixtureSnapshot {
  return {
    matchId: dataset.match.id,
    minute: dataset.match.minute,
    status: dataset.match.status,
    homeScore: dataset.match.homeScore,
    awayScore: dataset.match.awayScore,
    half: dataset.match.half,
    shots: dataset.shots,
    momentum: dataset.momentum,
  };
}

export function detectEvents(prev: FixtureSnapshot | undefined, next: FixtureSnapshot): LiveEvent[] {
  const events: LiveEvent[] = [];

  // Kickoff.
  if (prev?.status !== "live" && next.status === "live") {
    events.push({ type: "kickoff", matchId: next.matchId, at: Date.now() });
  }

  // Score changes → goal events. Attribute to most recent goal shot by team.
  const homeDelta = next.homeScore - (prev?.homeScore ?? 0);
  const awayDelta = next.awayScore - (prev?.awayScore ?? 0);
  const attributeGoal = (team: "home" | "away", n: number) => {
    const teamGoals = next.shots
      .filter((s) => s.team === team && s.outcome === "goal")
      .sort((a, b) => b.minute - a.minute)
      .slice(0, n);
    for (const g of teamGoals) {
      events.push({ type: "goal", matchId: next.matchId, team, scorer: g.player, minute: g.minute, xG: g.xG });
    }
  };
  if (homeDelta > 0) attributeGoal("home", homeDelta);
  if (awayDelta > 0) attributeGoal("away", awayDelta);

  // Half / Full-time transitions.
  if (prev && prev.half !== next.half) {
    if (/half.?time|HT/i.test(next.half)) {
      events.push({ type: "half-time", matchId: next.matchId, minute: next.minute });
    }
    if (next.status === "finished" && prev.status !== "finished") {
      events.push({
        type: "full-time",
        matchId: next.matchId,
        minute: next.minute,
        final: `${next.homeScore}-${next.awayScore}`,
      });
    }
  }

  // Big-xG chances (>=0.35) that are new since prev.
  const prevShotIds = new Set((prev?.shots ?? []).map((s) => s.id));
  for (const s of next.shots) {
    if (!prevShotIds.has(s.id) && s.xG >= 0.35 && s.outcome !== "goal") {
      events.push({
        type: "big-chance",
        matchId: next.matchId,
        team: s.team,
        player: s.player,
        xG: s.xG,
        minute: s.minute,
      });
    }
  }

  // Momentum swing: compare mean of last 3 samples vs previous 3.
  const m = next.momentum;
  if (m.length >= 6) {
    const recent = mean(m.slice(-3));
    const before = mean(m.slice(-6, -3));
    const delta = recent - before;
    if (Math.abs(delta) >= 0.5) {
      events.push({
        type: "momentum-swing",
        matchId: next.matchId,
        from: before > 0.15 ? "home" : before < -0.15 ? "away" : "neutral",
        to: recent > 0 ? "home" : "away",
        magnitude: Math.abs(delta),
      });
    }
  }

  return events;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
