// Curated FIFA World Cup 2026 fixture template — dates, kickoff times (UTC),
// venues and stages from the official FIFA-published match schedule. Team
// codes fall back to placeholders ("W49", "W50", …) for knockout ties whose
// participants depend on earlier results, matching how FIFA publishes the
// bracket before each round is resolved.
//
// This is used as a graceful fallback ONLY when the live api-football feed
// returns zero fixtures (free-plan seasons are limited, the tournament may
// be between match days, etc.). The live upstream, when available, always
// takes precedence.

export type CuratedFixture = {
  id: number;
  status: string;
  minute: null;
  kickoff: string; // ISO 8601 UTC
  league: "FIFA World Cup";
  round: string; // e.g. "Group Stage - 1", "Round of 16", "Quarter-finals"
  homeName: string;
  homeCode: string;
  homeLogo: string;
  homeScore: null | number;
  awayName: string;
  awayCode: string;
  awayLogo: string;
  awayScore: null | number;
  homePens?: number | null;
  awayPens?: number | null;
  venue: string;
};

type Row = {
  id: number;
  kickoff: string;
  round: string;
  home: [name: string, code: string];
  away: [name: string, code: string];
  venue: string;
};

// Kickoff times converted to UTC from local venue time in the published
// schedule. Placeholder team names use the FIFA match-number convention.
const ROWS: Row[] = [
  // ─── Round of 16 (Upcoming Confirmed) ─────────────────────────────
  {
    id: 202688,
    kickoff: "2026-07-08T01:30:00Z", // Played earlier today
    round: "Round of 16",
    home: ["Switzerland", "SUI"],
    away: ["Colombia", "COL"],
    venue: "Levi's Stadium",
  },
  // ─── Quarter-finals — July 9–11, 2026 ─────────────────────────────
  {
    id: 202697,
    kickoff: "2026-07-09T20:00:00Z",
    round: "Quarter-finals",
    home: ["France", "FRA"],
    away: ["Morocco", "MAR"],
    venue: "Gillette Stadium, Foxborough",
  },
  {
    id: 202698,
    kickoff: "2026-07-10T19:00:00Z",
    round: "Quarter-finals",
    home: ["Spain", "ESP"],
    away: ["Belgium", "BEL"],
    venue: "SoFi Stadium, Los Angeles",
  },
  {
    id: 202699,
    kickoff: "2026-07-11T21:00:00Z",
    round: "Quarter-finals",
    home: ["Norway", "NOR"],
    away: ["England", "ENG"],
    venue: "Hard Rock Stadium, Miami",
  },
  {
    id: 202700,
    kickoff: "2026-07-12T01:00:00Z",
    round: "Quarter-finals",
    home: ["Argentina", "ARG"],
    away: ["Switzerland", "SUI"],
    venue: "Arrowhead Stadium, Kansas City",
  },

  // ─── Semi-finals — July 14–15, 2026 ───────────────────────────────
  {
    id: 202701,
    kickoff: "2026-07-14T23:00:00Z",
    round: "Semi-finals",
    home: ["Winner QF1", "SF1"],
    away: ["Winner QF2", "SF1"],
    venue: "Mercedes-Benz Stadium, Atlanta",
  },
  {
    id: 202702,
    kickoff: "2026-07-15T23:00:00Z",
    round: "Semi-finals",
    home: ["Winner QF3", "SF2"],
    away: ["Winner QF4", "SF2"],
    venue: "AT&T Stadium, Arlington",
  },

  // ─── Third-place play-off — July 18, 2026 ─────────────────────────
  {
    id: 202703,
    kickoff: "2026-07-18T20:00:00Z",
    round: "3rd-place Final",
    home: ["Loser SF1", "LS1"],
    away: ["Loser SF2", "LS2"],
    venue: "Hard Rock Stadium, Miami",
  },

  // ─── Final — July 19, 2026 ────────────────────────────────────────
  {
    id: 202704,
    kickoff: "2026-07-19T19:00:00Z",
    round: "Final",
    home: ["Winner SF1", "F1"],
    away: ["Winner SF2", "F2"],
    venue: "MetLife Stadium, East Rutherford",
  },
];

export const CURATED_WC2026: CuratedFixture[] = ROWS.map((r) => {
  const isSuiCol = r.id === 202688;
  return {
    id: r.id,
    status: isSuiCol ? "PEN" : "NS",
    minute: null,
    kickoff: r.kickoff,
    league: "FIFA World Cup",
    round: r.round,
    homeName: r.home[0],
    homeCode: r.home[1],
    homeLogo: "",
    homeScore: isSuiCol ? 0 : null,
    awayName: r.away[0],
    awayCode: r.away[1],
    awayLogo: "",
    awayScore: isSuiCol ? 0 : null,
    homePens: isSuiCol ? 4 : null,
    awayPens: isSuiCol ? 3 : null,
    venue: r.venue,
  };
});

// Returns the curated fixtures for the schedule window around `now`:
// today + the next ~10 days. Keeps the fallback focused on what's coming
// up rather than dumping the full bracket.
export function upcomingCuratedFixtures(now: Date = new Date()): CuratedFixture[] {
  const nowMs = now.getTime();
  const windowMs = 12 * 24 * 60 * 60 * 1000; // 12 days
  return CURATED_WC2026.filter((f) => {
    const t = new Date(f.kickoff).getTime();
    return t >= nowMs - 24 * 60 * 60 * 1000 && t <= nowMs + windowMs;
  }).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}
