// Mocked FIFA World Cup match data for TACTIX AI demo.
// Multiple matches, each with its own dataset. Access via MATCHES and getMatchDataset(id).

export type Team = {
  code: string;
  name: string;
  color: string;
};

export type MatchStatus = "live" | "upcoming" | "finished";

export type MatchState = {
  id: string;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  homePens?: number;
  awayPens?: number;
  minute: number;
  half: string;
  competition: string;
  stage: string;
  status: MatchStatus;
  kickoff: string; // ISO or human label
  venue: string;
};

export type Insight = {
  id: string;
  kind: "insight" | "alert" | "danger";
  label: string;
  minute: string;
  body: string;
};

export type ShotEvent = {
  id: string;
  team: "home" | "away";
  xG: number;
  x: number;
  y: number;
  outcome: "goal" | "on-target" | "off-target" | "blocked";
  minute: number;
  player: string;
};

export type StatBlock = {
  label: string;
  home: string;
  away: string;
  homePct: number;
};

export type WinProbability = {
  home: number;
  draw: number;
  away: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type MatchDataset = {
  match: MatchState;
  insights: Insight[];
  shots: ShotEvent[];
  momentum: number[];
  stats: StatBlock[];
  winProbability: WinProbability;
  seedChat: ChatMessage[];
  suggestedQuestions: string[];
};

// ─── R16 · Portugal vs Spain (Tue, 7 Jul · 12:30) — headline showcase ─────
const POR_ESP: MatchDataset = {
  match: {
    id: "por-esp-r16",
    home: { code: "POR", name: "Portugal", color: "primary" },
    away: { code: "ESP", name: "Spain", color: "muted" },
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    half: "Pre-match",
    competition: "FIFA World Cup 2026",
    stage: "Round of 16",
    status: "upcoming",
    kickoff: "Tue, 7 Jul · 12:30 AM",
    venue: "MetLife Stadium",
  },
  insights: [
    { id: "1", kind: "insight", label: "PRE-MATCH", minute: "—", body: "Spain projected to hold 58% possession. Portugal likely to sit in a compact 4-4-2 mid-block waiting for transitions." },
    { id: "2", kind: "alert", label: "LINEUP WATCH", minute: "—", body: "Yamal starts on the right for Spain. Portugal expected to double up on him with Nuno Mendes and Bernardo tracking back." },
    { id: "3", kind: "insight", label: "MODEL FORECAST", minute: "—", body: "Model expects 1.6 xG for Spain, 1.1 for Portugal. Win probability: ESP 46%, Draw 27%, POR 27%." },
    { id: "4", kind: "insight", label: "PRESSING SHIFT", minute: "—", body: "Spain's PPDA in the group stage averaged 8.9 — highest press intensity in the R16 bracket." },
    { id: "5", kind: "alert", label: "SET-PIECE", minute: "—", body: "Portugal have scored 3 of 6 goals from set pieces so far. Ronaldo winning first contact on 62% of near-post corners." },
    { id: "6", kind: "insight", label: "TERRITORY", minute: "—", body: "Both sides average 55%+ territorial dominance. Expect a battle for the central third early on." },
  ],
  shots: [
    { id: "s1", team: "home", xG: 0.62, x: 88, y: 52, outcome: "goal", minute: 31, player: "Ronaldo" },
    { id: "s2", team: "home", xG: 0.18, x: 82, y: 40, outcome: "on-target", minute: 44, player: "B. Fernandes" },
    { id: "s3", team: "home", xG: 0.09, x: 74, y: 65, outcome: "off-target", minute: 57, player: "Leão" },
    { id: "s4", team: "home", xG: 0.28, x: 86, y: 48, outcome: "blocked", minute: 63, player: "Ronaldo" },
    { id: "s5", team: "home", xG: 0.42, x: 90, y: 55, outcome: "on-target", minute: 68, player: "B. Silva" },
    { id: "s6", team: "away", xG: 0.11, x: 22, y: 46, outcome: "off-target", minute: 18, player: "Yamal" },
    { id: "s7", team: "away", xG: 0.24, x: 14, y: 52, outcome: "on-target", minute: 39, player: "Pedri" },
    { id: "s8", team: "away", xG: 0.08, x: 26, y: 38, outcome: "blocked", minute: 61, player: "Nico" },
    { id: "s9", team: "away", xG: 0.19, x: 18, y: 58, outcome: "off-target", minute: 74, player: "Merino" },
  ],
  momentum: [0.1, 0.3, 0.55, 0.4, -0.2, -0.35, 0.15, 0.45, 0.7, 0.55, 0.35, -0.1, 0.2, 0.6, 0.75, 0.62, 0.8, 0.68],
  stats: [
    { label: "AVG POSSESSION (T)", home: "48%", away: "58%", homePct: 48 },
    { label: "xG PER MATCH", home: "1.42", away: "1.84", homePct: 44 },
    { label: "PASS ACCURACY", home: "86%", away: "91%", homePct: 49 },
    { label: "SHOTS PER GAME", home: "13", away: "17", homePct: 43 },
    { label: "PPDA", home: "10.4", away: "8.9", homePct: 46 },
    { label: "TERRITORY", home: "52%", away: "58%", homePct: 47 },
  ],
  winProbability: { home: 27, draw: 27, away: 46 },
  seedChat: [
    { id: "c1", role: "user", text: "How does Portugal contain Yamal on the right?" },
    { id: "c2", role: "assistant", text: "Portugal will need Nuno Mendes to stay narrow while Bernardo Silva drops to double up on the flank. Historically Yamal's xG per touch drops 41% when defended by two players in a 3m radius." },
  ],
  suggestedQuestions: [
    "How is Spain creating chances from the left half-space?",
    "Compare today's press to Portugal at Euro 2024.",
    "What's driving the win-probability shift after 60'?",
    "Where is Portugal losing duels?",
  ],
};

// ─── R16 · Canada vs Morocco (live) ───────────────────────────────────────
const CAN_MAR: MatchDataset = {
  match: {
    id: "can-mar-r16",
    home: { code: "CAN", name: "Canada", color: "primary" },
    away: { code: "MAR", name: "Morocco", color: "muted" },
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    half: "Pre-match",
    competition: "FIFA World Cup 2026",
    stage: "Round of 16",
    status: "upcoming",
    kickoff: "Sat, 4 Jul · 09:30 PM",
    venue: "BMO Field",
  },
  insights: [
    { id: "1", kind: "danger", label: "DANGER ZONE", minute: "62'", body: "Ounahi carrying into the half-space. xG threat vs Canada back line +0.29 in last 5 minutes." },
    { id: "2", kind: "insight", label: "AI INSIGHT", minute: "59'", body: "Canada shifting to a 3-2-5 in build-up. David pinning the full-back inside the box." },
    { id: "3", kind: "alert", label: "TRANSITION", minute: "54'", body: "Morocco winning duels centrally (61%) triggering fast breaks. Recovery-to-shot: 6.2s." },
    { id: "4", kind: "insight", label: "SET-PIECE THREAT", minute: "48'", body: "Canada has generated 0.36 xG from set pieces — Vitória winning first contact on 4/5 corners." },
    { id: "5", kind: "danger", label: "PRESSING TRAP", minute: "41'", body: "Morocco's high press bypasses Canada's pivot. AI flags rotational shift needed at CDM." },
  ],
  shots: [
    { id: "s1", team: "home", xG: 0.54, x: 87, y: 50, outcome: "goal", minute: 19, player: "David" },
    { id: "s2", team: "home", xG: 0.14, x: 76, y: 60, outcome: "on-target", minute: 55, player: "Buchanan" },
    { id: "s3", team: "home", xG: 0.09, x: 72, y: 38, outcome: "blocked", minute: 61, player: "Larin" },
    { id: "s4", team: "away", xG: 0.48, x: 12, y: 52, outcome: "goal", minute: 26, player: "En-Nesyri" },
    { id: "s5", team: "away", xG: 0.22, x: 20, y: 58, outcome: "on-target", minute: 58, player: "Ziyech" },
    { id: "s6", team: "away", xG: 0.11, x: 24, y: 42, outcome: "off-target", minute: 62, player: "Ounahi" },
  ],
  momentum: [0.2, 0.45, 0.55, 0.3, -0.1, -0.4, -0.55, -0.2, 0.15, 0.4, 0.35, 0.05, -0.25, -0.1, 0.2, 0.35, -0.15, -0.3],
  stats: [
    { label: "POSSESSION", home: "52%", away: "48%", homePct: 52 },
    { label: "xG (EXPECTED)", home: "0.77", away: "0.81", homePct: 49 },
    { label: "PASS ACCURACY", home: "84%", away: "87%", homePct: 46 },
    { label: "SHOTS ON TARGET", home: "3", away: "4", homePct: 43 },
    { label: "PPDA", home: "10.1", away: "9.4", homePct: 48 },
    { label: "TERRITORY", home: "49%", away: "51%", homePct: 49 },
  ],
  winProbability: { home: 34, draw: 30, away: 36 },
  seedChat: [
    { id: "c1", role: "assistant", text: "Even xG (0.77 vs 0.81) reflects the game state — both sides are trading transitions rather than sustaining pressure. AI expects a decisive moment in the final third of the match." },
  ],
  suggestedQuestions: [
    "How is Morocco exploiting Canada's right-back?",
    "Where should Canada rotate to break Morocco's press?",
    "What's the expected result if the game stays open?",
    "Compare xG per shot for both teams.",
  ],
};

// ─── R16 · Brazil vs Norway (Mon, 6 Jul · 01:30) ──────────────────────────
const BRA_NOR: MatchDataset = {
  match: {
    id: "bra-nor-r16",
    home: { code: "BRA", name: "Brazil", color: "primary" },
    away: { code: "NOR", name: "Norway", color: "muted" },
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    half: "Pre-match",
    competition: "FIFA World Cup 2026",
    stage: "Round of 16",
    status: "upcoming",
    kickoff: "Mon, 6 Jul · 01:30 AM",
    venue: "AT&T Stadium",
  },
  insights: [
    { id: "1", kind: "insight", label: "PRE-MATCH", minute: "—", body: "AI projects Brazil to hold 60% possession. Norway will lean on a 4-3-3 with Haaland stretching the back line." },
    { id: "2", kind: "alert", label: "LINEUP WATCH", minute: "—", body: "Vinícius confirmed on the left. Norway to shift Ryerson central to double up defensively." },
    { id: "3", kind: "insight", label: "MODEL FORECAST", minute: "—", body: "Model predicts 2.1 xG for Brazil, 1.0 for Norway. Win probability: BRA 58%, Draw 22%, NOR 20%." },
    { id: "4", kind: "danger", label: "TRANSITION THREAT", minute: "—", body: "Norway average 1.4 goals from counters per game — Brazil's high line vulnerable to Haaland runs in behind." },
  ],
  shots: [],
  momentum: [],
  stats: [
    { label: "POSSESSION", home: "35%", away: "65%", homePct: 35 },
    { label: "SHOTS (TOTAL)", home: "5", away: "4", homePct: 55 },
    { label: "SHOTS ON TARGET", home: "2", away: "2", homePct: 50 },
    { label: "PASSES", home: "159", away: "309", homePct: 34 },
    { label: "PASS ACCURACY", home: "88%", away: "92%", homePct: 49 },
    { label: "FOULS", home: "3", away: "1", homePct: 75 },
    { label: "CORNERS", home: "1", away: "3", homePct: 25 },
  ],
  winProbability: { home: 58, draw: 22, away: 20 },
  seedChat: [
    { id: "c1", role: "assistant", text: "Brazil enter as favourites but Norway's directness through Haaland tends to punish possession-heavy sides. Watch for Marquinhos stepping up early to disrupt long balls." },
  ],
  suggestedQuestions: [
    "What's the projected xG for each side?",
    "How does Norway isolate Haaland vs Brazil's back line?",
    "Which set-piece routines should we watch?",
    "Historical head-to-head trend?",
  ],
};

// ─── R16 · Argentina vs Egypt (Tue, 7 Jul · 21:30) ────────────────────────
const ARG_EGY: MatchDataset = {
  match: {
    id: "arg-egy-r16",
    home: { code: "ARG", name: "Argentina", color: "primary" },
    away: { code: "EGY", name: "Egypt", color: "muted" },
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    half: "Pre-match",
    competition: "FIFA World Cup 2026",
    stage: "Round of 16",
    status: "upcoming",
    kickoff: "Tue, 7 Jul · 09:30 PM",
    venue: "SoFi Stadium",
  },
  insights: [
    { id: "1", kind: "insight", label: "PRE-MATCH", minute: "—", body: "AI projects Argentina to hold 62% possession. Egypt likely to sit in a 5-3-2 mid-block anchored by Hegazi." },
    { id: "2", kind: "alert", label: "LINEUP WATCH", minute: "—", body: "Messi confirmed in a free 10 role. Salah leads Egypt's counter — Argentina's right-back positioning is key." },
    { id: "3", kind: "insight", label: "MODEL FORECAST", minute: "—", body: "Model predicts 1.9 xG for Argentina, 0.7 for Egypt. Win probability: ARG 64%, Draw 22%, EGY 14%." },
  ],
  shots: [],
  momentum: [],
  stats: [
    { label: "AVG POSSESSION (T)", home: "60%", away: "42%", homePct: 60 },
    { label: "xG PER MATCH", home: "1.88", away: "1.02", homePct: 65 },
    { label: "PASS ACCURACY", home: "89%", away: "81%", homePct: 55 },
    { label: "PPDA (T)", home: "9.4", away: "13.1", homePct: 42 },
  ],
  winProbability: { home: 64, draw: 22, away: 14 },
  seedChat: [
    { id: "c1", role: "assistant", text: "Argentina should dominate possession, but Egypt's back-five neutralises central overloads. Expect Messi to drop between the lines to draw the pivot up." },
  ],
  suggestedQuestions: [
    "How does Egypt neutralise Messi?",
    "What's Salah's threat on the counter?",
    "Which set-piece routines should we watch?",
    "Historical head-to-head trend?",
  ],
};

// ─── R16 · placeholder fixtures (no detailed dataset, generated stub) ─────
const R16_STUBS: MatchState[] = [
  {
    id: "par-fra-r16",
    home: { code: "PAR", name: "Paraguay", color: "primary" },
    away: { code: "FRA", name: "France", color: "muted" },
    homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match",
    competition: "FIFA World Cup 2026", stage: "Round of 16",
    status: "upcoming", kickoff: "Sun, 5 Jul · 02:30 AM", venue: "Mercedes-Benz Stadium",
  },
  {
    id: "mex-eng-r16",
    home: { code: "MEX", name: "Mexico", color: "primary" },
    away: { code: "ENG", name: "England 🟥", color: "muted" },
    homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match",
    competition: "FIFA World Cup 2026", stage: "Round of 16",
    status: "upcoming", kickoff: "Mon, 6 Jul · 05:30 AM", venue: "Estadio Azteca",
  },
  {
    id: "usa-bel-r16",
    home: { code: "USA", name: "USA", color: "primary" },
    away: { code: "BEL", name: "Belgium", color: "muted" },
    homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match",
    competition: "FIFA World Cup 2026", stage: "Round of 16",
    status: "upcoming", kickoff: "Tue, 7 Jul · 05:30 AM", venue: "Lincoln Financial Field",
  },
  {
    id: "sui-col-r16",
    home: { code: "SUI", name: "Switzerland", color: "primary" },
    away: { code: "COL", name: "Colombia", color: "muted" },
    homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match",
    competition: "FIFA World Cup 2026", stage: "Round of 16",
    status: "upcoming", kickoff: "Wed, 8 Jul · 01:30 AM", venue: "Levi's Stadium",
  },
];

// ─── QF / SF / 3rd / Final placeholders (TBD teams) ───────────────────────
const TBD = (i: number): Team => ({ code: "TBD", name: `TBD ${i}`, color: "muted" });

const KNOCKOUT_STUBS: MatchState[] = [
  { id: "qf-1", home: { code: "FRA", name: "France", color: "primary" }, away: { code: "MAR", name: "Morocco", color: "muted" }, homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Quarterfinals", status: "upcoming", kickoff: "Fri, 10 Jul · 01:30 AM", venue: "Gillette Stadium" },
  { id: "qf-2", home: { code: "ESP", name: "Spain", color: "primary" }, away: { code: "BEL", name: "Belgium", color: "muted" }, homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Quarterfinals", status: "upcoming", kickoff: "Sat, 11 Jul · 12:30 AM", venue: "SoFi Stadium" },
  { id: "qf-3", home: { code: "NOR", name: "Norway", color: "primary" }, away: { code: "ENG", name: "England", color: "muted" }, homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Quarterfinals", status: "upcoming", kickoff: "Sun, 12 Jul · 02:30 AM", venue: "Hard Rock Stadium" },
  { id: "qf-4", home: { code: "ARG", name: "Argentina", color: "primary" }, away: { code: "SUI", name: "Switzerland", color: "muted" }, homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Quarterfinals", status: "upcoming", kickoff: "Sun, 12 Jul · 06:30 AM", venue: "Arrowhead Stadium" },
  { id: "sf-1", home: TBD(9), away: TBD(10), homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Semifinals", status: "upcoming", kickoff: "Wed, 15 Jul · 12:30 AM", venue: "MetLife Stadium" },
  { id: "sf-2", home: TBD(11), away: TBD(12), homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Semifinals", status: "upcoming", kickoff: "Thu, 16 Jul · 12:30 AM", venue: "AT&T Stadium" },
  { id: "third-place", home: TBD(13), away: TBD(14), homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Third-place play-off", status: "upcoming", kickoff: "Sun, 19 Jul · 02:30 AM", venue: "Hard Rock Stadium" },
  { id: "final", home: TBD(15), away: TBD(16), homeScore: 0, awayScore: 0, minute: 0, half: "Pre-match", competition: "FIFA World Cup 2026", stage: "Final", status: "upcoming", kickoff: "Mon, 20 Jul · 12:30 AM", venue: "MetLife Stadium" },
];

const DATASETS: MatchDataset[] = [CAN_MAR, BRA_NOR, POR_ESP, ARG_EGY];

// Build a generic stub dataset for fixtures without curated content so every
// match card links to a working dashboard (used for R16 stubs + all TBD
// knockout placeholders).
function stubDataset(match: MatchState): MatchDataset {
  const isTBD = match.home.code === "TBD" || match.away.code === "TBD";
  return {
    match,
    insights: isTBD
      ? [
          { id: "1", kind: "insight", label: "AWAITING TEAMS", minute: "—", body: `${match.stage} · kickoff ${match.kickoff}. Teams are decided by the preceding bracket — AI preview will unlock once both sides are confirmed.` },
        ]
      : [
          { id: "1", kind: "insight", label: "PRE-MATCH", minute: "—", body: `${match.home.name} vs ${match.away.name} — ${match.stage}, ${match.competition}. Full tactical preview loads at kickoff.` },
          { id: "2", kind: "alert", label: "LINEUP WATCH", minute: "—", body: "Confirmed lineups drop 60 minutes before kickoff. AI projections update the moment they're in." },
        ],
    shots: [],
    momentum: [],
    stats: [
      { label: "STATUS", home: match.stage, away: match.kickoff, homePct: 50 },
    ],
    winProbability: { home: 33, draw: 34, away: 33 },
    seedChat: [
      { id: "c1", role: "assistant", text: isTBD
        ? `This ${match.stage.toLowerCase()} slot fills once the bracket resolves. Ask me about historical form for the possible qualifiers.`
        : `Ask me anything about ${match.home.name} vs ${match.away.name} — form, tactics, projected xG, or key duels.` },
    ],
    suggestedQuestions: isTBD
      ? ["Who are the likely qualifiers?", "Which side has the toughest path?", "Historical winner probabilities from this bracket slot?"]
      : [
          `How have ${match.home.name} performed so far?`,
          `What's ${match.away.name}'s biggest tactical strength?`,
          "Projected xG for this fixture?",
          "Key head-to-head trend?",
        ],
  };
}

function parseKickoff(kickoffStr: string): Date {
  const match = kickoffStr.match(/(\d+)\s+(\w+)\s*·\s*(\d+):(\d+)\s*([AP]M)/);
  if (!match) return new Date();
  const [_, dayStr, monthStr, hourStr, minStr, ampm] = match;
  const day = parseInt(dayStr);
  const month = monthStr.startsWith("Jun") ? 5 : 6; // Jun = 5, Jul = 6
  let hour = parseInt(hourStr);
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const minute = parseInt(minStr);
  return new Date(2026, month, day, hour, minute);
}

export function enrichMatchStateWithLiveTime(match: MatchState): MatchState {
  if (!match.kickoff) return match;

  const kickoffDate = parseKickoff(match.kickoff);
  const now = new Date();
  const diffMs = now.getTime() - kickoffDate.getTime();

  const updated = { ...match };

  if (diffMs < 0) {
    updated.status = "upcoming";
    updated.half = "Pre-match";
    updated.minute = 0;
  } else if (diffMs <= 105 * 60 * 1000) { // 105 minutes duration
    updated.status = "live";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 45) {
      updated.half = "1st Half";
      updated.minute = minutes;
    } else if (minutes < 60) {
      updated.half = "Halftime";
      updated.minute = 45;
    } else {
      updated.half = "2nd Half";
      updated.minute = Math.min(90, minutes - 15);
    }

    if (match.id === "bra-nor-r16") {
      updated.homeScore = 0;
      updated.awayScore = 0;
    }
  } else {
    updated.status = "finished";
    updated.half = "Full time";
    updated.minute = 90;

    if (match.id === "can-mar-r16") {
      updated.homeScore = 0;
      updated.awayScore = 3;
    } else if (match.id === "bra-nor-r16") {
      updated.homeScore = 1;
      updated.awayScore = 2;
    } else if (match.id === "par-fra-r16") {
      updated.homeScore = 0;
      updated.awayScore = 1;
    } else if (match.id === "mex-eng-r16") {
      updated.homeScore = 2;
      updated.awayScore = 3;
    } else if (match.id === "usa-bel-r16") {
      updated.homeScore = 1;
      updated.awayScore = 4;
    } else if (match.id === "sui-col-r16") {
      updated.homeScore = 0;
      updated.awayScore = 0;
      updated.homePens = 4;
      updated.awayPens = 3;
      updated.half = "FT (P)";
    } else if (match.id === "por-esp-group") {
      updated.homeScore = 0;
      updated.awayScore = 1;
    } else if (match.id === "arg-egy-group") {
      updated.homeScore = 3;
      updated.awayScore = 2;
    }
  }

  return updated;
}

const rawMatches: MatchState[] = [
  ...DATASETS.map((d) => d.match),
  ...R16_STUBS,
  ...KNOCKOUT_STUBS,
];

export const MATCHES: MatchState[] = new Proxy(rawMatches, {
  get(target, prop) {
    if (prop === "length") return target.length;
    if (typeof prop === "string" && !isNaN(Number(prop))) {
      const idx = Number(prop);
      if (idx >= 0 && idx < target.length) {
        return enrichMatchStateWithLiveTime(target[idx]);
      }
    }
    const val = Reflect.get(target, prop);
    if (typeof val === "function") {
      return val.bind(target.map(enrichMatchStateWithLiveTime));
    }
    return val;
  }
});

export function getMatchDataset(id: string): MatchDataset | undefined {
  const curated = DATASETS.find((d) => d.match.id === id);
  if (curated) {
    return {
      ...curated,
      match: enrichMatchStateWithLiveTime(curated.match)
    };
  }
  const stub = MATCHES.find((m) => m.id === id);
  return stub ? stubDataset(enrichMatchStateWithLiveTime(stub)) : undefined;
}

// Back-compat exports (used by anything still referencing the featured match).
export const MATCH = enrichMatchStateWithLiveTime(POR_ESP.match);
export const INSIGHTS = POR_ESP.insights;
export const MOMENTUM = POR_ESP.momentum;
export const SHOTS = POR_ESP.shots;
export const STATS = POR_ESP.stats;
export const WIN_PROBABILITY = POR_ESP.winProbability;
export const SEED_CHAT = POR_ESP.seedChat;
export const SUGGESTED_QUESTIONS = POR_ESP.suggestedQuestions;

export function getFlagEmoji(nameOrCode: string): string {
  const clean = nameOrCode.trim().toUpperCase();
  if (clean === "BRA" || clean === "BRAZIL") return "🇧🇷";
  if (clean === "NOR" || clean === "NORWAY") return "🇳🇴";
  if (clean === "CAN" || clean === "CANADA") return "🇨🇦";
  if (clean === "MAR" || clean === "MOROCCO") return "🇲🇦";
  if (clean === "EGY" || clean === "EGYPT") return "🇪🇬";
  if (clean === "USA" || clean === "UNITED STATES" || clean === "UNITED STATES OF AMERICA") return "🇺🇸";
  if (clean === "MEX" || clean === "MEXICO") return "🇲🇽";
  if (clean === "GER" || clean === "GERMANY") return "🇩🇪";
  if (clean === "FRA" || clean === "FRANCE") return "🇫🇷";
  if (clean === "ARG" || clean === "ARGENTINA") return "🇦🇷";
  if (clean === "PRG" || clean === "PRAGUEY" || clean === "PARAGUAY" || clean === "PAR") return "🇵🇾";
  if (clean === "COL" || clean === "COLOMBIA") return "🇨🇴";
  if (clean === "ESP" || clean === "SPAIN") return "🇪🇸";
  if (clean === "ENG" || clean === "ENGLAND" || clean === "GBR") return "🇬🇧";
  if (clean === "ITA" || clean === "ITALY") return "🇮🇹";
  if (clean === "POR" || clean === "PORTUGAL") return "🇵🇹";
  if (clean === "NED" || clean === "NETHERLANDS") return "🇳🇱";
  if (clean === "CRO" || clean === "CROATIA") return "🇭🇷";
  if (clean === "JPN" || clean === "JAPAN") return "🇯🇵";
  if (clean === "KOR" || clean === "SOUTH KOREA") return "🇰🇷";
  if (clean === "AUS" || clean === "AUSTRALIA") return "🇦🇺";
  if (clean === "URU" || clean === "URUGUAY") return "🇺🇾";
  if (clean === "BEL" || clean === "BELGIUM") return "🇧🇪";
  if (clean === "SUI" || clean === "CHE" || clean === "SWITZERLAND" || clean === "SWITZERLANG") return "🇨🇭";
  return "";
}

