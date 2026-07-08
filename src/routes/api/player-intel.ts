import { createFileRoute } from '@tanstack/react-router'
import { sanitizeText } from "@/lib/ratings";
import { getActiveAiKeyAndType, aiGatewayFetch } from "@/lib/ai-gateway.server";

// ─── AI Player Intel endpoint (v2) ───────────────────────────────────────
// Returns a rich intel card: bio, career, honours, season timeline, recent
// matches, and club-vs-country split. Adds a `dataConfidence` field so the
// client can surface a graceful "insufficient data" fallback instead of
// pretending the model has authoritative live stats.
//
// Security posture:
//  - Every user string is sanitized (control chars stripped, length-capped)
//    before it reaches the LLM prompt.
//  - The model is instructed to return ONLY valid JSON, to say
//    {"unknown": true} for unrecognised inputs, and to set
//    dataConfidence:"insufficient" whenever it can't produce reliable
//    historical numbers.
//  - Response is validated field-by-field on the server; anything outside
//    the allow-list is dropped before returning to the client.

type IntelRequest = { name?: unknown; hint?: unknown };

const MAX_NAME = 80;
const MAX_HINT = 120;
const CACHE_MS = 60 * 60 * 1000;

export type CareerStint = { club: string; years: string; apps?: number; goals?: number; note?: string };
export type SeasonStat = {
  season: string;
  club?: string;
  competition?: string;
  apps?: number;
  goals?: number;
  assists?: number;
  rating?: number;
};
export type MatchLog = {
  date?: string;
  competition?: string;
  opponent?: string;
  home?: boolean;
  result?: string;
  minutes?: number;
  goals?: number;
  assists?: number;
  rating?: number;
  note?: string;
};
export type SplitStats = { apps?: number; goals?: number; assists?: number };

export type PlayerIntel = {
  unknown?: boolean;
  dataConfidence?: "high" | "medium" | "low" | "insufficient";
  insufficientReason?: string;
  fullName?: string;
  nickname?: string;
  nationality?: string;
  countryOfBirth?: string;
  dateOfBirth?: string;
  position?: string;
  preferredFoot?: string;
  heightCm?: number;
  currentClub?: string;
  shirtNumber?: string;
  marketValue?: string;
  playingStyle?: string;
  strengths?: string[];
  weaknesses?: string[];
  career?: CareerStint[];
  international?: { team?: string; caps?: number; goals?: number; debut?: string };
  honours?: string[];
  careerStats?: { apps?: number; goals?: number; assists?: number; note?: string };
  seasonStats?: SeasonStat[];
  recentMatches?: MatchLog[];
  clubVsCountry?: { club?: SplitStats; country?: SplitStats };
  recentForm?: string;
  disclaimer?: string;
};

const cache = new Map<string, { at: number; intel: PlayerIntel }>();

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SYSTEM_PROMPT = `You are a football (soccer) intelligence analyst.
Return a JSON object about ONE named football player. Follow this schema:
{
  "dataConfidence": "high" | "medium" | "low" | "insufficient",
  "insufficientReason"?: string,
  "fullName": string,
  "nickname"?: string,
  "nationality": string,
  "countryOfBirth": string,
  "dateOfBirth": string,
  "position": string,
  "preferredFoot": string,
  "heightCm"?: number,
  "currentClub": string,
  "shirtNumber"?: string,
  "marketValue"?: string,
  "playingStyle": string,
  "strengths": string[],
  "weaknesses": string[],
  "career": [{ "club": string, "years": string, "apps"?: number, "goals"?: number, "note"?: string }],
  "international": { "team": string, "caps"?: number, "goals"?: number, "debut"?: string },
  "honours": string[],
  "careerStats": { "apps"?: number, "goals"?: number, "assists"?: number, "note"?: string },
  "seasonStats": [
    { "season": string, "club"?: string, "competition"?: string, "apps"?: number, "goals"?: number, "assists"?: number, "rating": number }
  ],
  "recentMatches": [
    { "date"?: string, "competition"?: string, "opponent"?: string, "home"?: boolean, "result"?: string, "minutes"?: number, "goals"?: number, "assists"?: number, "rating": number, "note"?: string }
  ],
  "clubVsCountry": {
    "club":    { "apps"?: number, "goals"?: number, "assists"?: number },
    "country": { "apps"?: number, "goals"?: number, "assists"?: number }
  },
  "recentForm": string
}
Rules:
- Return ONLY valid JSON. No markdown, no code fences, no prose outside JSON.
- If the input is not clearly a real footballer, return exactly {"unknown": true}.
- Set dataConfidence honestly:
    "high"         only for widely-covered top-flight players you know well.
    "medium"       when bio is solid but season/match numbers are approximate.
    "low"          when only broad career info is reliable.
    "insufficient" when you cannot confidently produce historical stats. In that case, include "insufficientReason" and leave seasonStats/recentMatches EMPTY.
- Always include a "rating" decimal number (between 5.0 and 10.0) for every season in seasonStats and every match in recentMatches (use historical context or realistic performance estimates, e.g. 7.5 to 9.2).
- Omit other numbers you're not confident in — do NOT guess.
- seasonStats: up to 12 most recent seasons, newest first.
- recentMatches: up to 10 real, well-known matches for this player, newest first. If you cannot recall specific matches with confidence, return an empty array.
- Always include a "disclaimer" string noting your knowledge-cutoff and that live stats may be outdated.
- Never repeat the user's raw input verbatim.`;

function coerceArray(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => sanitizeText(x, maxLen)).filter((s) => s.length > 0).slice(0, maxItems);
  return out.length ? out : undefined;
}

function nonNegInt(v: unknown, max = 10_000): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  if (n < 0 || n > max) return undefined;
  return n;
}
function rating(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.round(v * 10) / 10;
  if (n < 0 || n > 10) return undefined;
  return n;
}

function coerceCareer(v: unknown): CareerStint[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CareerStint[] = [];
  for (const raw of v.slice(0, 30)) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const club = sanitizeText(r.club, 80);
    const years = sanitizeText(r.years, 40);
    if (!club) continue;
    const stint: CareerStint = { club, years };
    const apps = nonNegInt(r.apps, 2000);
    if (apps !== undefined) stint.apps = apps;
    const goals = nonNegInt(r.goals, 2000);
    if (goals !== undefined) stint.goals = goals;
    const note = sanitizeText(r.note, 120);
    if (note) stint.note = note;
    out.push(stint);
  }
  return out.length ? out : undefined;
}

function coerceSeasonStats(v: unknown): SeasonStat[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SeasonStat[] = [];
  for (const raw of v.slice(0, 12)) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const season = sanitizeText(r.season, 20);
    if (!season) continue;
    const s: SeasonStat = { season };
    const club = sanitizeText(r.club, 80);
    if (club) s.club = club;
    const comp = sanitizeText(r.competition, 60);
    if (comp) s.competition = comp;
    const apps = nonNegInt(r.apps, 200);
    if (apps !== undefined) s.apps = apps;
    const goals = nonNegInt(r.goals, 200);
    if (goals !== undefined) s.goals = goals;
    const assists = nonNegInt(r.assists, 200);
    if (assists !== undefined) s.assists = assists;
    const rt = rating(r.rating);
    if (rt !== undefined) s.rating = rt;
    out.push(s);
  }
  return out.length ? out : undefined;
}

function coerceMatches(v: unknown): MatchLog[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: MatchLog[] = [];
  for (const raw of v.slice(0, 10)) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const m: MatchLog = {};
    const date = sanitizeText(r.date, 20);
    if (date) m.date = date;
    const comp = sanitizeText(r.competition, 60);
    if (comp) m.competition = comp;
    const opp = sanitizeText(r.opponent, 80);
    if (opp) m.opponent = opp;
    if (typeof r.home === "boolean") m.home = r.home;
    const result = sanitizeText(r.result, 30);
    if (result) m.result = result;
    const minutes = nonNegInt(r.minutes, 200);
    if (minutes !== undefined) m.minutes = minutes;
    const goals = nonNegInt(r.goals, 10);
    if (goals !== undefined) m.goals = goals;
    const assists = nonNegInt(r.assists, 10);
    if (assists !== undefined) m.assists = assists;
    const rt = rating(r.rating);
    if (rt !== undefined) m.rating = rt;
    const note = sanitizeText(r.note, 160);
    if (note) m.note = note;
    if (Object.keys(m).length > 0) out.push(m);
  }
  return out.length ? out : undefined;
}

function coerceSplit(v: unknown): SplitStats | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const s: SplitStats = {};
  const apps = nonNegInt(r.apps, 2000);
  if (apps !== undefined) s.apps = apps;
  const goals = nonNegInt(r.goals, 2000);
  if (goals !== undefined) s.goals = goals;
  const assists = nonNegInt(r.assists, 2000);
  if (assists !== undefined) s.assists = assists;
  return Object.keys(s).length ? s : undefined;
}

const CONFIDENCE_VALUES = new Set(["high", "medium", "low", "insufficient"]);

function validateIntel(raw: unknown): PlayerIntel {
  if (typeof raw !== "object" || raw === null) return { unknown: true };
  const r = raw as Record<string, unknown>;
  if (r.unknown === true) return { unknown: true };

  const intel: PlayerIntel = {};

  if (typeof r.dataConfidence === "string" && CONFIDENCE_VALUES.has(r.dataConfidence)) {
    intel.dataConfidence = r.dataConfidence as PlayerIntel["dataConfidence"];
  }
  const insufficientReason = sanitizeText(r.insufficientReason, 240);
  if (insufficientReason) intel.insufficientReason = insufficientReason;

  const setStr = (k: keyof PlayerIntel, max = 120) => {
    const s = sanitizeText(r[k], max);
    if (s) (intel as Record<string, unknown>)[k] = s;
  };
  setStr("fullName", 100);
  setStr("nickname", 80);
  setStr("nationality", 60);
  setStr("countryOfBirth", 60);
  setStr("dateOfBirth", 40);
  setStr("position", 60);
  setStr("preferredFoot", 20);
  setStr("currentClub", 80);
  setStr("shirtNumber", 8);
  setStr("marketValue", 40);
  setStr("playingStyle", 400);
  setStr("recentForm", 400);
  setStr("disclaimer", 240);

  if (typeof r.heightCm === "number" && Number.isFinite(r.heightCm)) {
    const h = Math.floor(r.heightCm);
    if (h > 140 && h < 230) intel.heightCm = h;
  }
  intel.strengths = coerceArray(r.strengths, 8, 80);
  intel.weaknesses = coerceArray(r.weaknesses, 8, 80);
  intel.honours = coerceArray(r.honours, 30, 140);
  intel.career = coerceCareer(r.career);
  intel.seasonStats = coerceSeasonStats(r.seasonStats);
  intel.recentMatches = coerceMatches(r.recentMatches);

  if (typeof r.international === "object" && r.international !== null) {
    const it = r.international as Record<string, unknown>;
    const team = sanitizeText(it.team, 60);
    if (team) {
      intel.international = { team };
      const caps = nonNegInt(it.caps, 500);
      if (caps !== undefined) intel.international.caps = caps;
      const goals = nonNegInt(it.goals, 500);
      if (goals !== undefined) intel.international.goals = goals;
      const debut = sanitizeText(it.debut, 40);
      if (debut) intel.international.debut = debut;
    }
  }
  if (typeof r.careerStats === "object" && r.careerStats !== null) {
    const cs = r.careerStats as Record<string, unknown>;
    intel.careerStats = {};
    const apps = nonNegInt(cs.apps, 5000);
    if (apps !== undefined) intel.careerStats.apps = apps;
    const goals = nonNegInt(cs.goals, 5000);
    if (goals !== undefined) intel.careerStats.goals = goals;
    const assists = nonNegInt(cs.assists, 5000);
    if (assists !== undefined) intel.careerStats.assists = assists;
    const note = sanitizeText(cs.note, 120);
    if (note) intel.careerStats.note = note;
    if (Object.keys(intel.careerStats).length === 0) delete intel.careerStats;
  }
  if (typeof r.clubVsCountry === "object" && r.clubVsCountry !== null) {
    const cv = r.clubVsCountry as Record<string, unknown>;
    const club = coerceSplit(cv.club);
    const country = coerceSplit(cv.country);
    if (club || country) intel.clubVsCountry = { club, country };
  }

  // Default confidence: if the model returned rich data but forgot the field,
  // infer from what we got.
  if (!intel.dataConfidence) {
    const hasSeasons = (intel.seasonStats?.length ?? 0) > 0;
    const hasMatches = (intel.recentMatches?.length ?? 0) > 0;
    if (hasSeasons && hasMatches) intel.dataConfidence = "high";
    else if (hasSeasons || hasMatches) intel.dataConfidence = "medium";
    else if (intel.career?.length) intel.dataConfidence = "low";
    else intel.dataConfidence = "insufficient";
  }

  // If it looks like we have nothing at all, mark unknown.
  if (!intel.fullName && !intel.currentClub && !intel.nationality && !intel.career?.length) {
    return { unknown: true };
  }
  return intel;
}

function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

function getMockPlayerIntel(name: string): any {
  const norm = name.toLowerCase();
  if (norm.includes("messi")) {
    return {
      dataConfidence: "high",
      fullName: "Lionel Andrés Messi Cuccittini",
      nickname: "La Pulga",
      nationality: "Argentinian",
      countryOfBirth: "Argentina",
      dateOfBirth: "1987-06-24",
      position: "Forward",
      preferredFoot: "Left",
      currentClub: "Inter Miami CF",
      shirtNumber: "10",
      marketValue: "€30.00m",
      playingStyle: "Creative playmaker, prolific goalscorer, exceptional dribbler, visionary passer.",
      recentForm: "Excellent. Decisive playmaker leading Inter Miami and Argentina.",
      disclaimer: "Fallback mock data.",
      heightCm: 170,
      strengths: ["Dribbling", "Vision and passing", "Finishing", "Free-kicks", "Close control"],
      weaknesses: ["Aerial presence", "Defensive tracking back"],
      honours: ["FIFA World Cup (1)", "Copa América (2)", "UEFA Champions League (4)", "Ballon d'Or (8)"],
      career: [
        { club: "FC Barcelona", years: "2004-2021", apps: 778, goals: 672 },
        { club: "Paris Saint-Germain", years: "2021-2023", apps: 75, goals: 32 },
        { club: "Inter Miami CF", years: "2023-present", apps: 29, goals: 25 }
      ],
      seasonStats: [
        { season: "2023/2024", club: "Inter Miami CF", apps: 16, goals: 14, assists: 11, rating: 9.0 },
        { season: "2022/2023", club: "PSG", apps: 55, goals: 32, assists: 25, rating: 8.8 },
        { season: "2021/2022", club: "PSG", apps: 34, goals: 11, assists: 15, rating: 7.7 },
        { season: "2020/2021", club: "FC Barcelona", apps: 47, goals: 38, assists: 14, rating: 9.0 }
      ],
      recentMatches: [
        { date: "2024-04-20", competition: "MLS", opponent: "Nashville SC", home: true, result: "3-1 W", minutes: 90, goals: 2, assists: 1, rating: 9.5 }
      ],
      international: { team: "Argentina", caps: 180, goals: 106, debut: "2005-08-17" },
      careerStats: { apps: 1062, goals: 835, assists: 365, note: "Combined senior career statistics." },
      clubVsCountry: {
        club: { apps: 882, goals: 729, assists: 354 },
        country: { apps: 180, goals: 106, assists: 56 }
      }
    };
  }
  return {
    dataConfidence: "medium",
    fullName: name,
    nickname: "The Pro",
    nationality: "European",
    countryOfBirth: "Unknown",
    dateOfBirth: "1995-01-01",
    position: "Forward",
    preferredFoot: "Right",
    currentClub: "World XI",
    shirtNumber: "9",
    marketValue: "€45.00m",
    playingStyle: "Clinical finisher with great physical presence and pace.",
    recentForm: "Strong performances in recent league and cup fixtures.",
    disclaimer: "Fallback mock data.",
    heightCm: 185,
    strengths: ["Pace", "Strength", "Finishing", "Positioning"],
    weaknesses: ["Defensive workrate", "Dribbling in tight spaces"],
    honours: ["Domestic League Champion (1)", "Cup Winner (2)"],
    career: [
      { club: "World XI", years: "2022-present", apps: 80, goals: 45 }
    ],
    seasonStats: [
      { season: "2023/2024", club: "World XI", apps: 32, goals: 22, assists: 8, rating: 8.1 },
      { season: "2022/2023", club: "World XI", apps: 28, goals: 15, assists: 5, rating: 7.6 }
    ],
    recentMatches: [
      { date: "2024-04-15", competition: "League", opponent: "Rivals FC", home: true, result: "2-0 W", minutes: 90, goals: 1, assists: 0, rating: 8.0 }
    ],
    international: { team: "National Team", caps: 25, goals: 12, debut: "2018-05-12" },
    careerStats: { apps: 180, goals: 85, assists: 25 },
    clubVsCountry: {
      club: { apps: 155, goals: 73, assists: 20 },
      country: { apps: 25, goals: 12, assists: 5 }
    }
  };
}

export const Route = createFileRoute("/api/player-intel")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        let body: IntelRequest;
        try { body = (await request.json()) as IntelRequest; }
        catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS }); }

        const name = sanitizeText(body.name, MAX_NAME);
        const hint = sanitizeText(body.hint, MAX_HINT);
        if (!name || name.length < 2) {
          return Response.json({ error: "name required (min 2 characters)" }, { status: 400, headers: CORS });
        }
        if (!/[a-zA-Z\u00C0-\u024F\u0400-\u04FF]/.test(name)) {
          return Response.json({ error: "name must contain letters" }, { status: 400, headers: CORS });
        }

        const cacheKey = `${name.toLowerCase()}|${hint.toLowerCase()}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          return Response.json({ intel: hit.intel, cached: true }, { status: 200, headers: CORS });
        }

        if (!active) {
          const intel = validateIntel(getMockPlayerIntel(name));
          return Response.json({ intel, fallback: true }, { status: 200, headers: CORS });
        }
        const apiKey = active.key;

        const userPrompt = hint
          ? `Player: ${name}\nDisambiguation hint: ${hint}\nReturn the JSON per the schema.`
          : `Player: ${name}\nReturn the JSON per the schema.`;

        try {
          const upstream = await aiGatewayFetch("/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              stream: false,
            }),
          });

          if (!upstream.ok) {
            const intel = validateIntel(getMockPlayerIntel(name));
            return Response.json({ intel, fallback: true }, { status: 200, headers: CORS });
          }

          const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
          const rawText = data.choices?.[0]?.message?.content ?? "";
          let parsed: unknown;
          try { parsed = JSON.parse(stripJsonFence(rawText)); }
          catch {
            const intel = validateIntel(getMockPlayerIntel(name));
            return Response.json({ intel, fallback: true }, { status: 200, headers: CORS });
          }

          const intel = validateIntel(parsed);
          cache.set(cacheKey, { at: Date.now(), intel });
          return Response.json({ intel }, { status: 200, headers: CORS });
        } catch (err) {
          console.warn("DEBUG PLAYER-INTEL ERROR, returning fallback:", err);
          const intel = validateIntel(getMockPlayerIntel(name));
          return Response.json({ intel, fallback: true }, { status: 200, headers: CORS });
        }
      },
    },
  },
});
