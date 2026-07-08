// Server-only: football-data.org fixture fetcher.
import type { MatchState, MatchStatus, Team } from "./match-data";

const API_BASE = "https://api.football-data.org/v4";

// Free-tier competitions on football-data.org
export const COMPETITIONS = [
  { code: "WC", label: "FIFA World Cup" },
  { code: "CL", label: "UEFA Champions League" },
  { code: "PL", label: "Premier League" },
  { code: "EC", label: "European Championship" },
  { code: "ELC", label: "Championship" },
  { code: "PD", label: "La Liga" },
  { code: "FL1", label: "Ligue 1" },
  { code: "SA", label: "Serie A" },
  { code: "DED", label: "Eredivisie" },
  { code: "PPL", label: "Primeira Liga" },
  { code: "BL1", label: "Bundesliga" },
  { code: "BSA", label: "Brasileirão" },
  { code: "CLI", label: "Copa Libertadores" },
] as const;

export type CompetitionCode = (typeof COMPETITIONS)[number]["code"];

export function isCompetitionCode(v: unknown): v is CompetitionCode {
  return typeof v === "string" && COMPETITIONS.some((c) => c.code === v);
}

export type FDPerson = { id?: number | null; name?: string | null } | null;
export type FDGoal = {
  minute: number;
  injuryTime?: number | null;
  type?: string | null; // REGULAR, OWN, PENALTY
  team?: { id: number | null; name: string | null } | null;
  scorer?: FDPerson;
  assist?: FDPerson;
  score?: { home: number | null; away: number | null } | null;
};
export type FDBooking = {
  minute: number;
  team?: { id: number | null; name: string | null } | null;
  player?: FDPerson;
  card?: string | null; // YELLOW, RED, YELLOW_RED
};
export type FDSub = {
  minute: number;
  team?: { id: number | null; name: string | null } | null;
  playerOut?: FDPerson;
  playerIn?: FDPerson;
};

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  stage: string;
  group?: string | null;
  competition?: { name?: string | null; code?: string | null };
  homeTeam: { id: number | null; name: string | null; tla: string | null; formation?: string | null };
  awayTeam: { id: number | null; name: string | null; tla: string | null; formation?: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  venue?: string | null;
  goals?: FDGoal[];
  bookings?: FDBooking[];
  substitutions?: FDSub[];
};

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarterfinals",
    SEMI_FINALS: "Semifinals",
    THIRD_PLACE: "Third-place play-off",
    FINAL: "Final",
    REGULAR_SEASON: "League",
    PLAYOFFS: "Playoffs",
  };
  return map[stage] ?? stage.replace(/_/g, " ");
}

function mapStatus(s: string): MatchStatus {
  if (s === "IN_PLAY" || s === "PAUSED" || s === "LIVE") return "live";
  if (s === "FINISHED" || s === "AWARDED") return "finished";
  return "upcoming";
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC",
  }).replace(",", " ·") + " UTC";
}

function makeTeam(t: FDMatch["homeTeam"], muted = false): Team {
  const code = (t.tla ?? "TBD").toUpperCase();
  const name = t.name ?? "TBD";
  return { code, name, color: muted ? "muted" : "primary" };
}

function elapsedMinuteFromKickoff(utcDate: string): number {
  const kickoff = new Date(utcDate).getTime();
  if (!Number.isFinite(kickoff)) return 0;
  const diffMs = Date.now() - kickoff;
  // Rough elapsed clock: minutes since kickoff, cap at 120 (extra time).
  return Math.max(0, Math.min(120, Math.floor(diffMs / 60000)));
}

export function normalizeFixture(m: FDMatch, fallbackComp: string): MatchState {
  const status = mapStatus(m.status);
  const homeScore = m.score.fullTime.home ?? m.score.halfTime.home ?? 0;
  const awayScore = m.score.fullTime.away ?? m.score.halfTime.away ?? 0;
  // Free-tier football-data.org often omits `minute` — derive one from kickoff
  // so the scoreboard doesn't just say "0'".
  let minute = m.minute ?? 0;
  if (status === "live" && !minute) {
    minute = elapsedMinuteFromKickoff(m.utcDate);
  }

  let half = "Pre-match";
  if (status === "finished") half = "Full time";
  else if (status === "live") {
    if (minute <= 45) half = "1st Half";
    else if (minute <= 90) half = "2nd Half";
    else half = "Extra time";
  }

  return {
    id: `fd-${m.id}`,
    home: makeTeam(m.homeTeam),
    away: makeTeam(m.awayTeam, true),
    homeScore,
    awayScore,
    minute,
    half,
    competition: m.competition?.name ?? fallbackComp,
    stage: stageLabel(m.stage),
    status,
    kickoff: status === "live" ? `Live · ${minute}'` : formatKickoff(m.utcDate),
    venue: m.venue ?? "TBD",
  };
}

export type FixturesResult = {
  matches: MatchState[];
  competitionCode: CompetitionCode;
  competitionLabel: string;
  source: "live" | "fallback";
  error?: string;
};

export async function fetchCompetitionFixtures(
  competition: CompetitionCode,
  fallback: MatchState[],
): Promise<FixturesResult> {
  const label = COMPETITIONS.find((c) => c.code === competition)?.label ?? competition;
  const token = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY;
  if (!token) {
    return { matches: fallback, competitionCode: competition, competitionLabel: label, source: "fallback", error: "missing_api_key" };
  }
  try {
    const res = await fetch(`${API_BASE}/competitions/${competition}/matches`, {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) {
      return { matches: fallback, competitionCode: competition, competitionLabel: label, source: "fallback", error: `http_${res.status}` };
    }
    const data = (await res.json()) as { matches?: FDMatch[]; competition?: { name?: string } };
    if (!data.matches?.length) {
      return { matches: fallback, competitionCode: competition, competitionLabel: data.competition?.name ?? label, source: "fallback", error: "empty" };
    }
    const compLabel = data.competition?.name ?? label;
    const normalized = data.matches.map((m) => normalizeFixture(m, compLabel));
    // Overlay TheSportsDB for any live/just-finished match — football-data.org
    // free tier lags by several minutes and misses goals.
    const withRaw = data.matches.map((m, i) => ({ m, n: normalized[i] }));
    await Promise.all(
      withRaw.map(async ({ m, n }, i) => {
        if (n.status !== "live") return;
        try {
          const snap = await fetchSportsDbSnapshot(m.homeTeam.name ?? "", m.awayTeam.name ?? "", m.utcDate);
          if (snap) normalized[i] = applySnapshotToMatch(n, snap);
        } catch { /* ignore */ }
      }),
    );
    normalized.sort((a, b) => {
      const rank = (s: MatchStatus) => (s === "live" ? 0 : s === "upcoming" ? 1 : 2);
      return rank(a.status) - rank(b.status);
    });
    return { matches: normalized, competitionCode: competition, competitionLabel: compLabel, source: "live" };
  } catch (err) {
    return {
      matches: fallback,
      competitionCode: competition,
      competitionLabel: label,
      source: "fallback",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function fetchFixtureById(fixtureId: number): Promise<FDMatch | null> {
  const token = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/matches/${fixtureId}`, {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { match?: FDMatch } & FDMatch;
    return (data.match ?? data) as FDMatch;
  } catch {
    return null;
  }
}

export type TimelineEvent =
  | { kind: "goal"; minute: number; injuryTime?: number | null; teamSide: "home" | "away"; scorer: string; assist?: string | null; goalType: string; score?: { home: number; away: number } | null }
  | { kind: "card"; minute: number; teamSide: "home" | "away"; player: string; card: "YELLOW" | "RED" | "YELLOW_RED" | "UNKNOWN" }
  | { kind: "sub"; minute: number; teamSide: "home" | "away"; playerIn: string; playerOut: string }
  | { kind: "formation"; minute: number; teamSide: "home" | "away"; formation: string };

export type TimelineSource =
  | "full"          // provider returned detailed goal events
  | "synthesized"   // scores only; minutes/scorers estimated
  | "enriched"      // synthesized then filled in from an alternate provider
  | "empty";        // provider returned nothing usable

export type FixtureTimeline = {
  events: TimelineEvent[];
  homeFormation: string | null;
  awayFormation: string | null;
  /** True when no event-level data was provided by the API and we
   *  synthesized events from the score/status alone. Consumers can show
   *  a "scorer details unavailable" hint. */
  synthesized: boolean;
  /** Where the goal-level data came from. */
  source: TimelineSource;
  /** Human-readable note the UI can show as data-source status. */
  sourceNote: string;
};

/** Spread N goal minutes uniformly across [lo, hi]. */
function spreadMinutes(count: number, lo: number, hi: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round((lo + hi) / 2)];
  const step = (hi - lo) / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.round(lo + step * (i + 1)));
}

export function buildTimeline(raw: FDMatch): FixtureTimeline {
  const homeId = raw.homeTeam.id;
  const sideFor = (teamId: number | null | undefined): "home" | "away" =>
    teamId === homeId ? "home" : "away";
  const nameOf = (p: FDPerson): string => p?.name ?? "Unknown";

  const events: TimelineEvent[] = [];

  for (const g of raw.goals ?? []) {
    events.push({
      kind: "goal",
      minute: g.minute ?? 0,
      injuryTime: g.injuryTime ?? null,
      teamSide: sideFor(g.team?.id),
      scorer: nameOf(g.scorer ?? null),
      assist: g.assist?.name ?? null,
      goalType: (g.type ?? "REGULAR").replace(/_/g, " ").toLowerCase(),
      score: g.score && g.score.home != null && g.score.away != null
        ? { home: g.score.home, away: g.score.away }
        : null,
    });
  }
  for (const b of raw.bookings ?? []) {
    const c = (b.card ?? "").toUpperCase();
    events.push({
      kind: "card",
      minute: b.minute ?? 0,
      teamSide: sideFor(b.team?.id),
      player: nameOf(b.player ?? null),
      card: c === "YELLOW" || c === "RED" || c === "YELLOW_RED" ? c : "UNKNOWN",
    });
  }
  for (const s of raw.substitutions ?? []) {
    events.push({
      kind: "sub",
      minute: s.minute ?? 0,
      teamSide: sideFor(s.team?.id),
      playerIn: nameOf(s.playerIn ?? null),
      playerOut: nameOf(s.playerOut ?? null),
    });
  }

  const hasDetailedGoals = (raw.goals ?? []).length > 0;
  let synthesized = false;
  let source: TimelineSource = hasDetailedGoals ? "full" : "empty";

  // ── Free-tier fallback ────────────────────────────────────────────────
  // football-data.org's free tier often returns fixtures with no `goals`
  // array even when the score is > 0. Synthesize placeholder goal events
  // from halfTime vs fullTime and estimate minutes from kickoff + status.
  if (!hasDetailedGoals) {
    const ftHome = raw.score.fullTime.home ?? 0;
    const ftAway = raw.score.fullTime.away ?? 0;
    const htHome = raw.score.halfTime.home ?? 0;
    const htAway = raw.score.halfTime.away ?? 0;
    const totalGoals = ftHome + ftAway;
    if (totalGoals > 0) {
      synthesized = true;
      source = "synthesized";
    }
    const status = mapStatus(raw.status);
    // For live matches, cap the 2nd-half window at the current minute.
    const elapsed = status === "live"
      ? Math.max(1, raw.minute ?? elapsedMinuteFromKickoff(raw.utcDate))
      : 90;
    const firstHi = Math.min(45, elapsed);
    const secondLo = 46;
    const secondHi = Math.max(secondLo, Math.min(90, elapsed));

    const firstHalfHome = spreadMinutes(htHome, 1, firstHi);
    const firstHalfAway = spreadMinutes(htAway, 1, firstHi);
    const secondHalfHome = spreadMinutes(Math.max(0, ftHome - htHome), secondLo, secondHi);
    const secondHalfAway = spreadMinutes(Math.max(0, ftAway - htAway), secondLo, secondHi);

    for (const minute of firstHalfHome) {
      events.push({ kind: "goal", minute, teamSide: "home", scorer: "Scorer unavailable", goalType: "regular", score: null });
    }
    for (const minute of firstHalfAway) {
      events.push({ kind: "goal", minute, teamSide: "away", scorer: "Scorer unavailable", goalType: "regular", score: null });
    }
    for (const minute of secondHalfHome) {
      events.push({ kind: "goal", minute, teamSide: "home", scorer: "Scorer unavailable", goalType: "regular", score: null });
    }
    for (const minute of secondHalfAway) {
      events.push({ kind: "goal", minute, teamSide: "away", scorer: "Scorer unavailable", goalType: "regular", score: null });
    }
  }

  const homeFormation = raw.homeTeam.formation ?? null;
  const awayFormation = raw.awayTeam.formation ?? null;
  if (homeFormation) events.unshift({ kind: "formation", minute: 0, teamSide: "home", formation: homeFormation });
  if (awayFormation) events.unshift({ kind: "formation", minute: 0, teamSide: "away", formation: awayFormation });

  events.sort((a, b) => a.minute - b.minute);

  const sourceNote =
    source === "full"
      ? "football-data.org · full timeline"
      : source === "synthesized"
        ? "football-data.org · scores only (minutes estimated)"
        : "football-data.org · no events recorded";

  return { events, homeFormation, awayFormation, synthesized, source, sourceNote };
}

// ─── Alternate provider: TheSportsDB (fresher live data + scorers) ──────
// football-data.org's free tier lags by several minutes and often omits the
// `goals` array + `minute`. TheSportsDB frequently has the up-to-the-minute
// score, status, and a detailed timeline. Free key "3" is documented for
// community use; a project-specific key can be supplied via SPORTSDB_API_KEY.
type SDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  dateEvent?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string | null;
  strProgress?: string | null;
};

type SDbTimelineItem = {
  strTimeline?: string;         // "Goal" | "Card" | "subst" | ...
  strTimelineDetail?: string | null;
  intTime?: string | null;
  strPlayer?: string | null;
  strAssist?: string | null;
  strTeam?: string | null;
  strHome?: string | null;      // "Yes" (home) | "No" (away)
};

export type SDbSnapshot = {
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  minute: number;
  events: TimelineEvent[];
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapSDbStatus(s: string | null | undefined, minute: number): MatchStatus {
  const v = (s ?? "").toUpperCase();
  if (v === "FT" || v === "AET" || v === "PEN" || v === "AWD") return "finished";
  if (v === "1H" || v === "2H" || v === "HT" || v === "ET" || v === "BT" || v === "LIVE") return "live";
  if (v === "NS" || v === "TBD" || v === "PST" || v === "" || v === "CANC") return minute > 0 ? "live" : "upcoming";
  return "upcoming";
}

async function findSportsDbEvent(homeName: string, awayName: string, dateISO: string): Promise<SDbEvent | null> {
  const key = process.env.SPORTSDB_API_KEY || "3";
  if (!homeName || !awayName) return null;
  const q = `${homeName}_vs_${awayName}`.replace(/\s+/g, "_");
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${key}/searchevents.php?e=${encodeURIComponent(q)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { event?: SDbEvent[] | null };
    const list = data.event ?? [];
    if (!list.length) return null;
    const targetDate = dateISO.slice(0, 10);
    const nh = normalize(homeName);
    const na = normalize(awayName);
    return (
      list.find(
        (e) =>
          e.dateEvent === targetDate &&
          normalize(e.strHomeTeam ?? "") === nh &&
          normalize(e.strAwayTeam ?? "") === na,
      ) ??
      list.find(
        (e) =>
          normalize(e.strHomeTeam ?? "") === nh &&
          normalize(e.strAwayTeam ?? "") === na,
      ) ??
      null
    );
  } catch {
    return null;
  }
}

async function fetchSportsDbTimelineRaw(eventId: string): Promise<SDbTimelineItem[]> {
  const key = process.env.SPORTSDB_API_KEY || "3";
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${key}/lookuptimeline.php?id=${encodeURIComponent(eventId)}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { timeline?: SDbTimelineItem[] | null };
    return data.timeline ?? [];
  } catch {
    return [];
  }
}

function parseSDbTimeline(items: SDbTimelineItem[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const t of items) {
    const kind = (t.strTimeline ?? "").toLowerCase();
    const side: "home" | "away" = (t.strHome ?? "").toLowerCase() === "yes" ? "home" : "away";
    const minute = Number(t.intTime ?? "0") || 0;
    if (kind === "goal") {
      const detail = (t.strTimelineDetail ?? "regular").toLowerCase();
      events.push({
        kind: "goal",
        minute,
        teamSide: side,
        scorer: t.strPlayer ?? "Unknown",
        assist: t.strAssist || null,
        goalType: detail.includes("own") ? "own goal" : detail.includes("penalty") ? "penalty" : "regular",
        score: null,
      });
    } else if (kind === "card") {
      const d = (t.strTimelineDetail ?? "").toLowerCase();
      const card: "YELLOW" | "RED" | "YELLOW_RED" | "UNKNOWN" = d.includes("red")
        ? d.includes("yellow") ? "YELLOW_RED" : "RED"
        : d.includes("yellow") ? "YELLOW" : "UNKNOWN";
      events.push({ kind: "card", minute, teamSide: side, player: t.strPlayer ?? "Unknown", card });
    } else if (kind === "subst" || kind === "sub" || kind === "substitution") {
      events.push({
        kind: "sub",
        minute,
        teamSide: side,
        playerIn: t.strPlayer ?? "Unknown",
        playerOut: t.strAssist || "—",
      });
    }
  }
  return events;
}

/** Fetch the freshest snapshot for a fixture from TheSportsDB.
 *  Used to overlay score / minute / status / scorers on top of football-data.org. */
export async function fetchSportsDbSnapshot(
  homeName: string,
  awayName: string,
  utcDate: string,
): Promise<SDbSnapshot | null> {
  const ev = await findSportsDbEvent(homeName, awayName, utcDate);
  if (!ev?.idEvent) return null;
  const homeScore = Number(ev.intHomeScore ?? "0") || 0;
  const awayScore = Number(ev.intAwayScore ?? "0") || 0;
  const items = await fetchSportsDbTimelineRaw(ev.idEvent);
  const events = parseSDbTimeline(items);
  const maxMinute = events.reduce((m, e) => Math.max(m, e.minute), 0);
  const status = mapSDbStatus(ev.strStatus, maxMinute);
  // Prefer minute derived from timeline; otherwise from kickoff for live games.
  const minute =
    status === "live"
      ? Math.max(maxMinute, elapsedMinuteFromKickoff(utcDate))
      : maxMinute;
  return { homeScore, awayScore, status, minute, events };
}

/** Overlay a TheSportsDB snapshot onto a normalized fixture (score/minute/status).
 *  Prefers the alt provider when it has a higher goal count or a fresher status,
 *  which happens routinely on football-data.org's free tier. */
export function applySnapshotToMatch(match: MatchState, snap: SDbSnapshot): MatchState {
  const altTotal = snap.homeScore + snap.awayScore;
  const cur = (match.homeScore ?? 0) + (match.awayScore ?? 0);
  const prefer = altTotal > cur || (snap.status === "live" && match.status !== "live") || (snap.status === "finished" && match.status !== "finished");
  if (!prefer) return match;
  let half = match.half;
  if (snap.status === "finished") half = "Full time";
  else if (snap.status === "live") {
    if (snap.minute <= 45) half = "1st Half";
    else if (snap.minute <= 90) half = "2nd Half";
    else half = "Extra time";
  }
  return {
    ...match,
    homeScore: snap.homeScore,
    awayScore: snap.awayScore,
    minute: snap.minute,
    status: snap.status,
    half,
    kickoff: snap.status === "live" ? `Live · ${snap.minute}'` : match.kickoff,
  };
}

/** Best-effort enrichment for the tactical timeline. Fills in scorer names,
 *  goal minutes, cards and subs from TheSportsDB when available, and adopts
 *  its score if it's ahead of football-data.org. */
export async function enrichTimeline(raw: FDMatch, timeline: FixtureTimeline): Promise<FixtureTimeline> {
  const snap = await fetchSportsDbSnapshot(raw.homeTeam.name ?? "", raw.awayTeam.name ?? "", raw.utcDate);
  if (!snap) return timeline;
  const altGoalCount = snap.events.filter((e) => e.kind === "goal").length;
  const fdGoalCount = timeline.events.filter((e) => e.kind === "goal").length;
  // Only replace when the alt provider actually adds information.
  if (altGoalCount === 0 && snap.events.length === 0) return timeline;
  const shouldReplace = altGoalCount >= fdGoalCount;
  if (!shouldReplace) return timeline;
  // Preserve formation rows.
  const formations = timeline.events.filter((e) => e.kind === "formation");
  const merged = [...formations, ...snap.events].sort((a, b) => a.minute - b.minute);
  return {
    ...timeline,
    events: merged,
    synthesized: false,
    source: "enriched",
    sourceNote: "football-data.org + TheSportsDB · scorers & minutes",
  };
}


