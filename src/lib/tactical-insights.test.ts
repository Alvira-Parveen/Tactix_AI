import { describe, expect, it } from "vitest";
import { buildTacticalInsights } from "./tactical-insights";
import type { MatchState, StatBlock, WinProbability } from "./match-data";

function makeMatch(overrides: Partial<MatchState> = {}): MatchState {
  return {
    id: "test-match",
    home: { code: "ENG", name: "England", color: "primary" },
    away: { code: "BEL", name: "Belgium", color: "muted" },
    homeScore: 1,
    awayScore: 0,
    minute: 67,
    half: "2nd Half",
    competition: "Friendly",
    stage: "Friendly",
    status: "live",
    kickoff: "Now",
    venue: "Stadium",
    ...overrides,
  };
}

function makeStats(): StatBlock[] {
  return [
    { label: "POSSESSION", home: "58%", away: "42%", homePct: 58 },
    { label: "xG", home: "1.8", away: "0.6", homePct: 75 },
  ];
}

function makeWinProbability(): WinProbability {
  return { home: 62, draw: 24, away: 14 };
}

describe("buildTacticalInsights", () => {
  it("creates pre-match tactical guidance when the match is upcoming", () => {
    const insights = buildTacticalInsights(makeMatch({ status: "upcoming", minute: 0 }), makeStats(), makeWinProbability());

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((item) => item.body.toLowerCase().includes("press") || item.body.toLowerCase().includes("shape") || item.body.toLowerCase().includes("transition"))).toBe(true);
  });

  it("creates live-game insights for a team protecting a lead", () => {
    const insights = buildTacticalInsights(makeMatch({ homeScore: 2, awayScore: 1 }), makeStats(), makeWinProbability(), { isLive: true });

    expect(insights.some((item) => item.body.toLowerCase().includes("protect") || item.body.toLowerCase().includes("compact") || item.body.toLowerCase().includes("lead"))).toBe(true);
  });

  it("creates a post-match summary for completed fixtures", () => {
    const insights = buildTacticalInsights(makeMatch({ status: "finished", homeScore: 2, awayScore: 1 }), makeStats(), makeWinProbability());

    expect(insights.some((item) => item.body.toLowerCase().includes("finished") || item.body.toLowerCase().includes("control") || item.body.toLowerCase().includes("match"))).toBe(true);
  });
});
