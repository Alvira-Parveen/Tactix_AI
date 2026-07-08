import { createServerFn } from "@tanstack/react-start";
import { MATCHES, getMatchDataset, type MatchDataset } from "./match-data";
import { buildConversationPrompts, buildTacticalInsights } from "./tactical-insights";
import { buildLiveInsightPayload } from "./live-insights";
import {
  applySnapshotToMatch,
  buildTimeline,
  enrichTimeline,
  fetchCompetitionFixtures,
  fetchFixtureById,
  fetchSportsDbSnapshot,
  isCompetitionCode,
  normalizeFixture,
  type CompetitionCode,
  type FixtureTimeline,
  type FixturesResult,
} from "./fixtures.server";
import type { MatchState, MatchStatus, Insight } from "./match-data";

export type MatchInsightSummary = {
  summary: string;
  keyMoments: string[];
  tacticalNotes: string[];
  nextActions: string[];
};

export const getFixtures = createServerFn({ method: "GET" })
  .inputValidator((input: { competition?: string } | undefined) => {
    const comp = input?.competition;
    return { competition: isCompetitionCode(comp) ? comp : ("WC" as CompetitionCode) };
  })
  .handler(async ({ data }): Promise<FixturesResult> => {
    const fallback = data.competition === "WC" ? MATCHES : [];
    return fetchCompetitionFixtures(data.competition, fallback);
  });

export type FixtureDetail = {
  match: MatchState;
  utcDate: string;
  found: boolean;
  timeline: FixtureTimeline;
};

export const getFixtureDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { fixtureId: string }) => input)
  .handler(async ({ data }): Promise<FixtureDetail | null> => {
    const numeric = Number(data.fixtureId.replace(/^fd-/, ""));
    if (!Number.isFinite(numeric)) return null;
    const raw = await fetchFixtureById(numeric);
    if (!raw) return null;
    let match = normalizeFixture(raw, raw.competition?.name ?? "");
    const snap = await fetchSportsDbSnapshot(raw.homeTeam.name ?? "", raw.awayTeam.name ?? "", raw.utcDate);
    if (snap) match = applySnapshotToMatch(match, snap);
    const timeline = await enrichTimeline(raw, buildTimeline(raw));
    return { match, utcDate: raw.utcDate, found: true, timeline };
  });

// ─── Live overlay for demo dashboards ────────────────────────────────────
// Given a home/away 3-letter code (TLA), look up the corresponding real
// fixture on football-data.org (World Cup by default) so the demo match
// page can pin real live score + minute on top of its mock analytics.
export type LiveOverlay = {
  found: boolean;
  fixtureId?: string; // fd-<id>
  homeCode: string;
  awayCode: string;
  homeName?: string;
  awayName?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  status?: MatchStatus;
  half?: string;
  competition?: string;
  stage?: string;
  kickoff?: string;
};

export const getLiveOverlay = createServerFn({ method: "GET" })
  .inputValidator((input: { homeCode: string; awayCode: string; competition?: string }) => ({
    homeCode: input.homeCode.toUpperCase().slice(0, 3),
    awayCode: input.awayCode.toUpperCase().slice(0, 3),
    competition: isCompetitionCode(input.competition) ? input.competition : ("WC" as CompetitionCode),
  }))
  .handler(async ({ data }): Promise<LiveOverlay> => {
    const result = await fetchCompetitionFixtures(data.competition, []);
    if (result.source !== "live" || !result.matches.length) {
      return { found: false, homeCode: data.homeCode, awayCode: data.awayCode };
    }
    const pair = new Set([data.homeCode, data.awayCode]);
    // Prefer live > upcoming (soonest) > finished (most recent)
    const candidates = result.matches.filter((m) =>
      pair.has(m.home.code.toUpperCase()) && pair.has(m.away.code.toUpperCase()),
    );
    if (!candidates.length) return { found: false, homeCode: data.homeCode, awayCode: data.awayCode };
    const rank = (s: MatchStatus) => (s === "live" ? 0 : s === "upcoming" ? 1 : 2);
    candidates.sort((a, b) => rank(a.status) - rank(b.status));
    const m = candidates[0];
    return {
      found: true,
      fixtureId: m.id,
      homeCode: m.home.code,
      awayCode: m.away.code,
      homeName: m.home.name,
      awayName: m.away.name,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      minute: m.minute,
      status: m.status,
      half: m.half,
      competition: m.competition,
      stage: m.stage,
      kickoff: m.kickoff,
    };
  });

// ─── Unified match-dashboard resolver ────────────────────────────────────
// A single loader for /match/$matchId that handles BOTH:
//   • Real football-data.org fixtures (matchId starts with "fd-"): builds a
//     MatchDataset shim from the live fixture + its timeline. Widgets that
//     require mock analytics (shot map, momentum, ratings, AI commentary)
//     are hidden by the UI when `isLive` is true.
//   • Curated demo fixtures ("can-mar-r16" etc.): returns the hardcoded
//     dataset, with score/minute/status overlaid from a matching real
//     fixture when one is found — so the scoreboard stays truthful.
export type MatchDashboardData = {
  dataset: MatchDataset;
  isLive: boolean;
  timeline: FixtureTimeline | null;
  liveInsights?: MatchInsightSummary;
};

function insightsFromTimeline(t: FixtureTimeline, home: string, away: string): Insight[] {
  const teamCode = (side: "home" | "away") => (side === "home" ? home : away);
  const out: Insight[] = [];
  for (const e of t.events) {
    if (e.kind === "goal") {
      const suffix = e.goalType && e.goalType !== "regular" ? ` (${e.goalType})` : "";
      const score = e.score ? ` · ${e.score.home}–${e.score.away}` : "";
      out.push({
        id: `g-${e.minute}-${e.scorer}`,
        kind: "insight",
        label: `GOAL · ${teamCode(e.teamSide)}`,
        minute: `${e.minute}'`,
        body: `${e.scorer}${suffix}${e.assist ? ` · assist ${e.assist}` : ""}${score}`,
      });
    } else if (e.kind === "card") {
      const label = e.card === "RED" || e.card === "YELLOW_RED" ? "RED CARD" : "BOOKING";
      out.push({
        id: `c-${e.minute}-${e.player}`,
        kind: e.card === "RED" || e.card === "YELLOW_RED" ? "danger" : "alert",
        label: `${label} · ${teamCode(e.teamSide)}`,
        minute: `${e.minute}'`,
        body: `${e.player} — ${e.card.replace("_", " ").toLowerCase()}`,
      });
    } else if (e.kind === "sub") {
      out.push({
        id: `s-${e.minute}-${e.playerIn}`,
        kind: "alert",
        label: `SUBSTITUTION · ${teamCode(e.teamSide)}`,
        minute: `${e.minute}'`,
        body: `${e.playerIn} on for ${e.playerOut}`,
      });
    } else if (e.kind === "formation") {
      out.push({
        id: `f-${e.teamSide}`,
        kind: "insight",
        label: `FORMATION · ${teamCode(e.teamSide)}`,
        minute: "—",
        body: `${teamCode(e.teamSide)} lined up in a ${e.formation}.`,
      });
    }
  }
  return out.sort((a, b) => {
    const am = parseInt(a.minute, 10) || 0;
    const bm = parseInt(b.minute, 10) || 0;
    return bm - am; // newest first
  });
}

function enrichDataset(dataset: MatchDataset, isLive: boolean): MatchDataset {
  const generated = buildTacticalInsights(dataset.match, dataset.stats, dataset.winProbability, { isLive });
  const prompts = buildConversationPrompts(dataset.match, dataset.stats, dataset.winProbability);
  const combinedInsights = [...generated, ...dataset.insights].slice(0, 6);
  return {
    ...dataset,
    insights: combinedInsights,
    seedChat: prompts.seedChat,
    suggestedQuestions: prompts.suggestedQuestions,
  };
}

function buildLiveInsightSummary(dataset: MatchDataset): MatchInsightSummary {
  return buildLiveInsightPayload(dataset.match, dataset.stats, dataset.winProbability);
}

function datasetFromLiveFixture(match: MatchState, timeline: FixtureTimeline): MatchDataset {
  const homeGoals = timeline.events.filter((e) => e.kind === "goal" && e.teamSide === "home").length;
  const awayGoals = timeline.events.filter((e) => e.kind === "goal" && e.teamSide === "away").length;
  const homeCards = timeline.events.filter((e) => e.kind === "card" && e.teamSide === "home").length;
  const awayCards = timeline.events.filter((e) => e.kind === "card" && e.teamSide === "away").length;
  const homeSubs = timeline.events.filter((e) => e.kind === "sub" && e.teamSide === "home").length;
  const awaySubs = timeline.events.filter((e) => e.kind === "sub" && e.teamSide === "away").length;
  const stats = [
    { label: "GOALS", home: String(homeGoals), away: String(awayGoals), homePct: homeGoals + awayGoals === 0 ? 50 : Math.round((homeGoals / (homeGoals + awayGoals)) * 100) },
    { label: "BOOKINGS", home: String(homeCards), away: String(awayCards), homePct: homeCards + awayCards === 0 ? 50 : Math.round((homeCards / (homeCards + awayCards)) * 100) },
    { label: "SUBSTITUTIONS", home: String(homeSubs), away: String(awaySubs), homePct: homeSubs + awaySubs === 0 ? 50 : Math.round((homeSubs / (homeSubs + awaySubs)) * 100) },
    { label: "FORMATION", home: timeline.homeFormation ?? "—", away: timeline.awayFormation ?? "—", homePct: 50 },
  ];
  return {
    match,
    insights: insightsFromTimeline(timeline, match.home.code, match.away.code),
    shots: [],
    momentum: [],
    stats,
    winProbability: { home: 33, draw: 34, away: 33 },
    seedChat: [
      { id: "c1", role: "assistant", text: `Ask me anything about ${match.home.name} vs ${match.away.name} — form, tactics, key duels.` },
    ],
    suggestedQuestions: [
      `How are ${match.home.name} setting up?`,
      `What's ${match.away.name}'s biggest threat?`,
      "Key moments so far?",
      "How does the match look tactically?",
    ],
  };
}

export const getMatchDashboard = createServerFn({ method: "GET" })
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data }): Promise<MatchDashboardData | null> => {
    const { matchId } = data;

    // Path 1 — real fixture ID from football-data.org
    if (matchId.startsWith("fd-")) {
      const numeric = Number(matchId.replace(/^fd-/, ""));
      if (!Number.isFinite(numeric)) return null;
      const raw = await fetchFixtureById(numeric);
      if (!raw) return null;
      let match = normalizeFixture(raw, raw.competition?.name ?? "");
      const snap = await fetchSportsDbSnapshot(raw.homeTeam.name ?? "", raw.awayTeam.name ?? "", raw.utcDate);
      if (snap) match = applySnapshotToMatch(match, snap);
      const timeline = await enrichTimeline(raw, buildTimeline(raw));
      const dataset = enrichDataset(datasetFromLiveFixture(match, timeline), true);
      return { dataset, isLive: true, timeline, liveInsights: buildLiveInsightSummary(dataset) };
    }

    // Path 2 — curated demo dataset
    const base = getMatchDataset(matchId);
    if (!base) return null;

    // Try to overlay real score/minute/status from a matching real fixture
    // so the scoreboard is truthful even on the demo dashboard.
    try {
      const result = await fetchCompetitionFixtures("WC" as CompetitionCode, []);
      if (result.source === "live") {
        const pair = new Set([base.match.home.code.toUpperCase(), base.match.away.code.toUpperCase()]);
        const candidates = result.matches.filter(
          (m) => pair.has(m.home.code.toUpperCase()) && pair.has(m.away.code.toUpperCase()),
        );
        const rank = (s: MatchStatus) => (s === "live" ? 0 : s === "upcoming" ? 1 : 2);
        candidates.sort((a, b) => rank(a.status) - rank(b.status));
        const live = candidates[0];
        if (live) {
          // Also pull the live timeline for that fixture so any real events
          // show up in the tactical feed alongside curated content.
          let timeline: FixtureTimeline | null = null;
          const numeric = Number(live.id.replace(/^fd-/, ""));
          if (Number.isFinite(numeric)) {
            const raw = await fetchFixtureById(numeric);
            if (raw) timeline = buildTimeline(raw);
          }
          const merged: MatchDataset = {
            ...base,
            match: {
              ...base.match,
              homeScore: live.homeScore,
              awayScore: live.awayScore,
              minute: live.minute,
              half: live.half,
              status: live.status,
            },
          };
          return { dataset: enrichDataset(merged, false), isLive: false, timeline, liveInsights: buildLiveInsightSummary(merged) };
        }
      }
    } catch {
      /* ignore — fall through to unmerged demo dataset */
    }

    return { dataset: enrichDataset(base, false), isLive: false, timeline: null, liveInsights: buildLiveInsightSummary(base) };
  });
