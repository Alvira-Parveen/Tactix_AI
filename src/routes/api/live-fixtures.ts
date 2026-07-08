import { createFileRoute } from "@tanstack/react-router";
import { upcomingCuratedFixtures } from "@/lib/wc2026-schedule";

// ─── Live Football Fixtures via api-football.com ─────────────────────────
// Uses FOOTBALL_API_KEY (server-only). In-memory cache to protect the
// free-tier daily request budget (100/day).

type Fixture = {
  id: number;
  status: string;
  minute: number | null;
  kickoff: string;
  league: string;
  round: string;
  homeName: string;
  homeCode: string;
  homeLogo: string;
  homeScore: number | null;
  homePens?: number | null;
  awayName: string;
  awayCode: string;
  awayLogo: string;
  awayScore: number | null;
  awayPens?: number | null;
  venue: string;
};

type ApiFixtureResponse = {
  response?: Array<{
    fixture: {
      id: number;
      date: string;
      status: { short: string; elapsed: number | null };
      venue: { name: string | null };
    };
    league: { name: string; round: string };
    teams: {
      home: { name: string; logo: string };
      away: { name: string; logo: string };
    };
    goals: { home: number | null; away: number | null };
    score?: {
      penalty?: { home: number | null; away: number | null };
    };
  }>;
  errors?: unknown;
};

let cache: { at: number; data: Fixture[] } | null = null;
const CACHE_MS = 60_000; // 60s
const REQUEST_TIMEOUT_MS = 8_000;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function codeFor(name: string): string {
  const cleaned = name.replace(/[^A-Za-z ]/g, "").trim();
  if (!cleaned) return "—";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0] + (parts[2]?.[0] ?? "")).toUpperCase();
}

function normalize(payload: ApiFixtureResponse): Fixture[] {
  const rows = Array.isArray(payload.response) ? payload.response : [];
  return rows.slice(0, 12).map((r) => ({
    id: r.fixture.id,
    status: r.fixture.status.short,
    minute: r.fixture.status.elapsed,
    kickoff: r.fixture.date,
    league: String(r.league.name ?? "").slice(0, 80),
    round: String(r.league.round ?? "").slice(0, 80),
    homeName: String(r.teams.home.name ?? "").slice(0, 60),
    homeCode: codeFor(r.teams.home.name ?? ""),
    homeLogo: String(r.teams.home.logo ?? "").slice(0, 300),
    homeScore: r.goals.home,
    homePens: r.score?.penalty?.home ?? null,
    awayName: String(r.teams.away.name ?? "").slice(0, 60),
    awayCode: codeFor(r.teams.away.name ?? ""),
    awayLogo: String(r.teams.away.logo ?? "").slice(0, 300),
    awayScore: r.goals.away,
    awayPens: r.score?.penalty?.away ?? null,
    venue: String(r.fixture.venue.name ?? "").slice(0, 120),
  }));
}

// FIFA World Cup 2026 — api-football league id = 1, season = 2026.
// We restrict all queries to this competition so the dashboards only ever
// surface real WC 2026 fixtures (never club leagues, friendlies, etc.).
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

async function fetchLive(apiKey: string): Promise<Fixture[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const headers = { "x-apisports-key": apiKey };
  const base = "https://v3.football.api-sports.io/fixtures";
  try {
    // 1. Any WC 2026 match currently live.
    const liveRes = await fetch(
      `${base}?live=all&league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers, signal: ctrl.signal },
    );
    if (!liveRes.ok) throw new Error(`Upstream ${liveRes.status}`);
    const live = normalize((await liveRes.json()) as ApiFixtureResponse);
    if (live.length > 0) return live;

    // 2. Otherwise, today's WC 2026 fixtures.
    const today = new Date().toISOString().slice(0, 10);
    const dayRes = await fetch(
      `${base}?date=${today}&league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers, signal: ctrl.signal },
    );
    if (!dayRes.ok) throw new Error(`Upstream ${dayRes.status}`);
    const day = normalize((await dayRes.json()) as ApiFixtureResponse);
    if (day.length > 0) return day;

    // 3. Otherwise, the next upcoming WC 2026 fixtures.
    const nextRes = await fetch(
      `${base}?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&next=12`,
      { headers, signal: ctrl.signal },
    );
    if (!nextRes.ok) throw new Error(`Upstream ${nextRes.status}`);
    return normalize((await nextRes.json()) as ApiFixtureResponse);
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/live-fixtures")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const apiKey = process.env.FOOTBALL_API_KEY || process.env.FOOTBALL_DATA_API_KEY;
        const curated = upcomingCuratedFixtures();

        if (!apiKey) {
          return Response.json(
            { fixtures: curated, source: "curated-wc2026-schedule" },
            { status: 200, headers: CORS },
          );
        }

        if (cache && Date.now() - cache.at < CACHE_MS) {
          return Response.json(
            { fixtures: cache.data, source: "cache", cachedAt: cache.at },
            { status: 200, headers: CORS },
          );
        }

        try {
          const fixtures = await fetchLive(apiKey);
          if (fixtures.length === 0) {
            return Response.json(
              { fixtures: curated, source: "curated-wc2026-schedule" },
              { status: 200, headers: CORS },
            );
          }
          cache = { at: Date.now(), data: fixtures };
          return Response.json(
            { fixtures, source: "api-football" },
            { status: 200, headers: CORS },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json(
            {
              fixtures: cache?.data ?? curated,
              error: message,
              source: cache?.data ? "cache" : "curated-wc2026-schedule",
            },
            { status: 200, headers: CORS },
          );
        }
      },
    },
  },
});
