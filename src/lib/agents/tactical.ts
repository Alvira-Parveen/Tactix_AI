// ─── Tactical Analysis Agent ──────────────────────────────────────────────
// Pure algorithmic tactical inferences derived from the match dataset:
//   - Formation shape hint from shot distribution
//   - Pressing intensity from PPDA thresholds
//   - Territorial dominance zone
//   - Momentum swing classification
//   - Set-piece dependence ratio
// No LLM — deterministic, cheap, deterministic-verifiable.

import type { MatchDataset } from "@/lib/match-data";

export type TacticalReport = {
  matchId: string;
  attackChannel: { home: "left" | "central" | "right"; away: "left" | "central" | "right" };
  press: { home: PressIntensity; away: PressIntensity };
  territory: "home-dominant" | "away-dominant" | "balanced";
  momentumPhase: "home-surge" | "away-surge" | "trading" | "flat";
  xGEfficiency: { home: number; away: number }; // xG per shot
  setPieceLoad: { home: number; away: number }; // 0..1 rough proxy
  observations: string[];
};

export type PressIntensity = "very-high" | "high" | "medium" | "low";

function pressFromPPDA(ppda: number): PressIntensity {
  if (ppda <= 8) return "very-high";
  if (ppda <= 10.5) return "high";
  if (ppda <= 13) return "medium";
  return "low";
}

function channelOf(y: number): "left" | "central" | "right" {
  if (y < 33) return "left";
  if (y > 66) return "right";
  return "central";
}

export function tacticalReport(dataset: MatchDataset): TacticalReport {
  const { match, shots, stats } = dataset;

  // Attack channel: most-frequent y-band per side.
  const buckets = { home: { left: 0, central: 0, right: 0 }, away: { left: 0, central: 0, right: 0 } };
  for (const s of shots) {
    buckets[s.team][channelOf(s.y)] += 1;
  }
  const dominantChannel = (side: "home" | "away") => {
    const b = buckets[side];
    const entries = (Object.entries(b) as Array<["left" | "central" | "right", number]>).sort((a, z) => z[1] - a[1]);
    return entries[0][1] === 0 ? "central" : entries[0][0];
  };

  // Press intensity from PPDA stat if present.
  const ppdaRow = stats.find((s) => /ppda/i.test(s.label));
  const parseNum = (v: string) => Number(String(v).replace(/[^0-9.]/g, "")) || 0;
  const homePPDA = ppdaRow ? parseNum(ppdaRow.home) : 11;
  const awayPPDA = ppdaRow ? parseNum(ppdaRow.away) : 11;

  // Territory.
  const territoryRow = stats.find((s) => /territory/i.test(s.label));
  const homeTerritory = territoryRow ? parseNum(territoryRow.home) : 50;
  const territory: TacticalReport["territory"] =
    homeTerritory >= 57 ? "home-dominant" : homeTerritory <= 43 ? "away-dominant" : "balanced";

  // Momentum phase from tail of momentum array.
  const m = dataset.momentum;
  const tail = m.slice(-6);
  const avg = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
  const swings = tail.reduce((n, v, i, arr) => (i > 0 && Math.sign(v) !== Math.sign(arr[i - 1]) ? n + 1 : n), 0);
  const momentumPhase: TacticalReport["momentumPhase"] =
    swings >= 3 ? "trading" : avg >= 0.35 ? "home-surge" : avg <= -0.35 ? "away-surge" : "flat";

  // xG efficiency.
  const homeShots = shots.filter((s) => s.team === "home");
  const awayShots = shots.filter((s) => s.team === "away");
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const xGEff = {
    home: homeShots.length ? +(sum(homeShots.map((s) => s.xG)) / homeShots.length).toFixed(2) : 0,
    away: awayShots.length ? +(sum(awayShots.map((s) => s.xG)) / awayShots.length).toFixed(2) : 0,
  };

  // Set-piece load — high xG shots from central zone are proxies for set pieces.
  const setPieceLoad = {
    home: homeShots.length ? homeShots.filter((s) => s.xG >= 0.3 && s.y >= 40 && s.y <= 60).length / homeShots.length : 0,
    away: awayShots.length ? awayShots.filter((s) => s.xG >= 0.3 && s.y >= 40 && s.y <= 60).length / awayShots.length : 0,
  };

  // Observations.
  const obs: string[] = [];
  const home = dominantChannel("home");
  const away = dominantChannel("away");
  if (buckets.home[home] >= 3) obs.push(`${match.home.name} channelling attacks through the ${home} corridor (${buckets.home[home]} shots).`);
  if (buckets.away[away] >= 3) obs.push(`${match.away.name} generating from the ${away} half-space (${buckets.away[away]} shots).`);
  const homePress = pressFromPPDA(homePPDA);
  const awayPress = pressFromPPDA(awayPPDA);
  if (homePress === "very-high") obs.push(`${match.home.name} pressing very high (PPDA ${homePPDA.toFixed(1)}).`);
  if (awayPress === "very-high") obs.push(`${match.away.name} pressing very high (PPDA ${awayPPDA.toFixed(1)}).`);
  if (territory === "home-dominant") obs.push(`${match.home.name} controlling territory at ${homeTerritory}%.`);
  if (territory === "away-dominant") obs.push(`${match.away.name} pushing the game into ${match.home.name}'s half (${100 - homeTerritory}%).`);
  if (momentumPhase === "home-surge") obs.push(`${match.home.name} in a clear momentum phase.`);
  if (momentumPhase === "away-surge") obs.push(`${match.away.name} in a clear momentum phase.`);
  if (setPieceLoad.home >= 0.3) obs.push(`${match.home.name} carrying set-piece dependence (${Math.round(setPieceLoad.home * 100)}% of quality chances).`);
  if (xGEff.home >= 0.25) obs.push(`${match.home.name} xG/shot ${xGEff.home} — high-quality selection.`);
  if (xGEff.away >= 0.25) obs.push(`${match.away.name} xG/shot ${xGEff.away} — high-quality selection.`);

  return {
    matchId: match.id,
    attackChannel: { home, away },
    press: { home: homePress, away: awayPress },
    territory,
    momentumPhase,
    xGEfficiency: xGEff,
    setPieceLoad,
    observations: obs,
  };
}

// ─── Dangerous attack detector ────────────────────────────────────────────
// Flags moments where a side generated a genuinely dangerous sequence in a
// short rolling window. Signal = weighted sum of (xG in window) +
// (final-third entries proxied from shot count) + goal bonus, above a
// threshold. Emits one alert per team per detected minute.

export type DangerAlert = {
  id: string;
  team: "home" | "away";
  teamName: string;
  minute: number;
  channel: "left" | "central" | "right";
  intensity: "elevated" | "high" | "critical";
  xGSum: number;
  shotCount: number;
  headline: string;
};

export function detectDangerousAttacks(dataset: MatchDataset): DangerAlert[] {
  const { shots, match } = dataset;
  if (shots.length === 0) return [];

  const WINDOW = 4; // minutes
  const byTeam: Record<"home" | "away", typeof shots> = {
    home: shots.filter((s) => s.team === "home").sort((a, b) => a.minute - b.minute),
    away: shots.filter((s) => s.team === "away").sort((a, b) => a.minute - b.minute),
  };

  const alerts: DangerAlert[] = [];
  const seenMinutes = new Set<string>();

  (["home", "away"] as const).forEach((team) => {
    const teamShots = byTeam[team];
    for (let i = 0; i < teamShots.length; i++) {
      const anchor = teamShots[i];
      const window = teamShots.filter((s) => s.minute >= anchor.minute && s.minute <= anchor.minute + WINDOW);
      const xGSum = window.reduce((a, s) => a + s.xG, 0);
      const shotCount = window.length;
      const hasGoal = window.some((s) => s.outcome === "goal");
      const bigChance = window.some((s) => s.xG >= 0.3);

      // Threshold: window xG >= 0.4 OR 2+ shots with a big chance OR any goal
      const score = xGSum + (bigChance ? 0.25 : 0) + (hasGoal ? 0.5 : 0) + shotCount * 0.05;
      const passes = xGSum >= 0.4 || (shotCount >= 2 && bigChance) || hasGoal;
      if (!passes) continue;

      const key = `${team}-${anchor.minute}`;
      if (seenMinutes.has(key)) continue;
      seenMinutes.add(key);

      // Skip if we already flagged an alert within 3 minutes for the same team.
      if (alerts.some((a) => a.team === team && Math.abs(a.minute - anchor.minute) < 3)) continue;

      const channel = channelOf(anchor.y);
      const intensity: DangerAlert["intensity"] = hasGoal ? "critical" : score >= 0.85 ? "high" : "elevated";
      const teamName = team === "home" ? match.home.name : match.away.name;
      const headline = hasGoal
        ? `${teamName} score — ${xGSum.toFixed(2)} xG from the ${channel} channel`
        : `${teamName} building through the ${channel} channel — ${shotCount} shots · ${xGSum.toFixed(2)} xG in ${WINDOW}′`;

      alerts.push({
        id: `danger-${team}-${anchor.minute}`,
        team,
        teamName,
        minute: anchor.minute,
        channel,
        intensity,
        xGSum: +xGSum.toFixed(2),
        shotCount,
        headline,
      });
    }
  });

  return alerts.sort((a, b) => b.minute - a.minute);
}
