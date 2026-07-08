import { describe, expect, it } from "vitest";
import { buildFixtureBriefPayload, buildMatchPreviewText } from "./live-insights";
import type { MatchState } from "./match-data";

const baseMatch: MatchState = {
  id: "demo-match",
  home: { code: "AFC", name: "AFC Side", color: "primary" },
  away: { code: "BFC", name: "BFC Side", color: "muted" },
  homeScore: 1,
  awayScore: 0,
  minute: 63,
  half: "Second Half",
  competition: "Club Friendly",
  stage: "Group Stage",
  status: "live",
  kickoff: "Tonight",
  venue: "Stadium",
};

describe("buildFixtureBriefPayload", () => {
  it("returns a structured tactical brief for live matches", () => {
    const payload = buildFixtureBriefPayload(baseMatch, [{ label: "POSSESSION", home: "54%", away: "46%", homePct: 54 }], {
      home: 58,
      draw: 22,
      away: 20,
    });

    expect(payload.brief).toContain("AFC Side");
    expect(payload.summary).toContain("AFC Side");
    expect(payload.keyMoments.length).toBeGreaterThan(0);
    expect(payload.tacticalNotes.some((note) => note.toLowerCase().includes("defensive"))).toBe(true);
    expect(payload.nextActions.length).toBeGreaterThan(0);
  });

  it("keeps the brief concise for upcoming fixtures", () => {
    const payload = buildFixtureBriefPayload({ ...baseMatch, status: "upcoming", minute: 0, half: "Pre-match" }, []);
    expect(payload.brief.length).toBeLessThanOrEqual(320);
    expect(payload.summary).toContain("opening pattern");
  });

  it("creates a compact card preview for the match hub", () => {
    const preview = buildMatchPreviewText(baseMatch);
    expect(preview).toContain("AFC Side");
    expect(preview.length).toBeLessThan(180);
  });
});
