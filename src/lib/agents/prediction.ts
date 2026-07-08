// ─── Prediction Agent ─────────────────────────────────────────────────────
// Real math (Poisson bivariate) for win/draw/loss and next-goal probability,
// derived from live xG totals, remaining minutes, and current score. Not a
// pre-authored number — recomputed each call.

import type { MatchDataset } from "@/lib/match-data";

export type MatchOutcome = {
  matchId: string;
  home: number; // %
  draw: number; // %
  away: number; // %
  nextGoal: { home: number; away: number; none: number }; // % over remaining time
  expectedFinal: { home: number; away: number };
  method: "poisson-bivariate";
};

const MAX_GOALS = 8;

function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Convert xG so far + remaining minutes to expected goals for the full match. */
function expectedFullMatch(
  xGSoFar: number,
  minutePlayed: number,
  status: "upcoming" | "live" | "finished",
): { xGRemaining: number; xGFull: number } {
  if (status === "finished") return { xGRemaining: 0, xGFull: xGSoFar };
  if (status === "upcoming" || minutePlayed <= 0) {
    // Use xG per match as prior when nothing has happened yet.
    return { xGRemaining: xGSoFar, xGFull: xGSoFar };
  }
  const rate = xGSoFar / Math.max(1, minutePlayed);
  const remaining = Math.max(0, 90 - minutePlayed);
  const xGRemaining = rate * remaining;
  return { xGRemaining, xGFull: xGSoFar + xGRemaining };
}

export function predictOutcome(dataset: MatchDataset): MatchOutcome {
  const { match, shots, stats } = dataset;

  // xG so far from shots. If no shots (pre-match), fall back to stat block.
  const xgHome = shots.filter((s) => s.team === "home").reduce((a, s) => a + s.xG, 0);
  const xgAway = shots.filter((s) => s.team === "away").reduce((a, s) => a + s.xG, 0);

  let xGHomeSoFar = xgHome;
  let xGAwaySoFar = xgAway;
  if (xGHomeSoFar === 0 && xGAwaySoFar === 0) {
    const xgRow = stats.find((s) => /xG/i.test(s.label));
    if (xgRow) {
      xGHomeSoFar = Number(String(xgRow.home).replace(/[^0-9.]/g, "")) || 1.2;
      xGAwaySoFar = Number(String(xgRow.away).replace(/[^0-9.]/g, "")) || 1.0;
    } else {
      xGHomeSoFar = 1.2;
      xGAwaySoFar = 1.0;
    }
  }

  const homeFull = expectedFullMatch(xGHomeSoFar, match.minute, match.status);
  const awayFull = expectedFullMatch(xGAwaySoFar, match.minute, match.status);

  // Bivariate Poisson (independent) — enumerate final goals.
  let pHome = 0, pDraw = 0, pAway = 0;
  const currentHome = match.homeScore;
  const currentAway = match.awayScore;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const pH = poissonPMF(h, homeFull.xGRemaining);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const pA = poissonPMF(a, awayFull.xGRemaining);
      const p = pH * pA;
      const finalHome = currentHome + h;
      const finalAway = currentAway + a;
      if (finalHome > finalAway) pHome += p;
      else if (finalHome < finalAway) pAway += p;
      else pDraw += p;
    }
  }
  const total = pHome + pDraw + pAway || 1;

  // Next-goal probability over remaining minutes (competing Poisson).
  const lambdaSum = homeFull.xGRemaining + awayFull.xGRemaining;
  let nextHome = 0, nextAway = 0, nextNone = 1;
  if (lambdaSum > 0.001) {
    nextNone = Math.exp(-lambdaSum); // P(0 goals in remaining time)
    const anyGoal = 1 - nextNone;
    nextHome = anyGoal * (homeFull.xGRemaining / lambdaSum);
    nextAway = anyGoal * (awayFull.xGRemaining / lambdaSum);
  }

  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  const pctSimple = (v: number) => Math.round(v * 1000) / 10;

  return {
    matchId: match.id,
    home: pct(pHome),
    draw: pct(pDraw),
    away: pct(pAway),
    nextGoal: { home: pctSimple(nextHome), away: pctSimple(nextAway), none: pctSimple(nextNone) },
    expectedFinal: {
      home: +(currentHome + homeFull.xGRemaining).toFixed(2),
      away: +(currentAway + awayFull.xGRemaining).toFixed(2),
    },
    method: "poisson-bivariate",
  };
}
