// Tactical intelligence deep-dive data (heatmaps, pass networks, pressing traps,
// per-player scouting notes). Mocked but shaped to feel like real analytics.

import { getMatchDataset } from "@/lib/match-data";

export type PlayerNode = {
  id: string;
  num: number;
  name: string;
  role: string; // e.g. "LW", "CM", "CB"
  x: number; // 0..100 (attacking left→right for home)
  y: number; // 0..100 (top→bottom)
  heat: { x: number; y: number; w: number }[]; // heatmap blobs
  touches: number;
  rating: number; // 0..10
  note: string;
};

export type PassEdge = {
  from: string; // player id
  to: string;
  weight: number; // 0..1 relative strength
};

export type PressingTrap = {
  id: string;
  x: number; // 0..100
  y: number;
  w: number;
  h: number;
  intensity: number; // 0..1
  team: "home" | "away";
  label: string;
  note: string;
};

export type IntelPack = {
  summary: string;
  homeXI: PlayerNode[];
  awayXI: PlayerNode[];
  passEdges: { home: PassEdge[]; away: PassEdge[] };
  pressingTraps: PressingTrap[];
};

// ---------- generators ----------

// 4-3-3 default positions (x from own goal 5 to attack 95, home attacks →)
const HOME_433: Array<{ role: string; x: number; y: number }> = [
  { role: "GK", x: 6, y: 50 },
  { role: "RB", x: 24, y: 82 },
  { role: "RCB", x: 20, y: 60 },
  { role: "LCB", x: 20, y: 40 },
  { role: "LB", x: 24, y: 18 },
  { role: "RCM", x: 46, y: 62 },
  { role: "CM", x: 42, y: 50 },
  { role: "LCM", x: 46, y: 38 },
  { role: "RW", x: 78, y: 78 },
  { role: "ST", x: 82, y: 50 },
  { role: "LW", x: 78, y: 22 },
];

// Away mirrored (attacks ←): x' = 100 - x
const AWAY_433 = HOME_433.map((p) => ({ ...p, x: 100 - p.x }));

function makeHeat(x: number, y: number, spread: number): PlayerNode["heat"] {
  return [
    { x, y, w: 1 },
    { x: x + spread * 0.6, y: y + spread * 0.4, w: 0.7 },
    { x: x - spread * 0.5, y: y - spread * 0.3, w: 0.6 },
    { x: x + spread * 0.2, y: y - spread * 0.6, w: 0.55 },
    { x: x - spread * 0.4, y: y + spread * 0.5, w: 0.5 },
  ];
}

function buildXI(
  teamCode: string,
  positions: typeof HOME_433,
  names: string[],
  ratings: number[],
  notes: string[],
): PlayerNode[] {
  return positions.map((p, i) => {
    const spread = p.role === "GK" ? 4 : p.role.includes("CB") ? 8 : 14;
    return {
      id: `${teamCode}-${i}`,
      num: [1, 2, 4, 5, 3, 8, 6, 10, 7, 9, 11][i] ?? i + 1,
      name: names[i] ?? `${teamCode} #${i + 1}`,
      role: p.role,
      x: p.x,
      y: p.y,
      heat: makeHeat(p.x, p.y, spread),
      touches: 20 + Math.round(spread * 3.2) + (i % 3) * 7,
      rating: ratings[i] ?? 6.8,
      note: notes[i] ?? "Solid outing, no notable interventions.",
    };
  });
}

function defaultEdges(xi: PlayerNode[]): PassEdge[] {
  // Chain plausible pairs: CBs↔CMs, CMs↔wingers, wingers↔ST.
  // xi order matches HOME_433: 0 GK, 1 RB, 2 RCB, 3 LCB, 4 LB,
  // 5 RCM, 6 CM, 7 LCM, 8 RW, 9 ST, 10 LW
  const pair = (a: number, b: number, w: number): PassEdge => ({
    from: xi[a].id,
    to: xi[b].id,
    weight: w,
  });
  return [
    pair(2, 6, 0.9),
    pair(3, 6, 0.85),
    pair(2, 5, 0.7),
    pair(3, 7, 0.7),
    pair(6, 5, 0.75),
    pair(6, 7, 0.75),
    pair(5, 8, 0.8),
    pair(7, 10, 0.8),
    pair(8, 9, 0.65),
    pair(10, 9, 0.6),
    pair(1, 5, 0.55),
    pair(4, 7, 0.55),
    pair(0, 2, 0.4),
    pair(0, 3, 0.4),
  ];
}

// ---------- match-specific packs ----------

const ESP_NAMES = ["Simón", "Carvajal", "Le Normand", "Laporte", "Cucurella", "Rodri", "Merino", "Pedri", "Yamal", "Morata", "Nico"];
const ESP_RATINGS = [6.9, 7.1, 7.4, 7.6, 6.8, 8.2, 7.5, 8.4, 8.7, 6.7, 7.3];
const ESP_NOTES = [
  "Comfortable in build-up, one composed sweep at 41'.",
  "Overlapping runs stretched England's LB; 3 progressive carries.",
  "Won 5/6 aerial duels, key clearance in the 62' box scramble.",
  "Defensive line leader; anchored the back four's step-up press.",
  "Provided width on the left; underlapping run set up 68' chance.",
  "Screened the pivot; 94% pass accuracy, broke lines 11 times.",
  "Box-to-box drives created two half-chances, tireless engine.",
  "Orchestrated tempo from the left half-space; 3 chances created.",
  "Match-winner. 1v1 dominance, 0.62 xG goal at 31', 6 progressive carries.",
  "Physical presence, dropped to link play; 1 shot on target.",
  "Direct running unsettled RB; got behind twice for cutbacks.",
];

const ENG_NAMES = ["Pickford", "Walker", "Stones", "Guéhi", "Shaw", "Rice", "Bellingham", "Foden", "Saka", "Kane", "Palmer"];
const ENG_RATINGS = [7.2, 6.6, 6.9, 7.0, 6.4, 7.3, 6.5, 6.8, 6.7, 6.6, 6.9];
const ENG_NOTES = [
  "Kept England in it; 4 saves, one point-blank from Merino.",
  "Caught high by Yamal on the goal; recovered better after 45'.",
  "Stepped out well but late to close the Pedri switch at 68'.",
  "Solid duel numbers (7/9) but positioning drifted under pressure.",
  "Isolated by Yamal repeatedly, minimal attacking output.",
  "Best England midfielder; 3 tackles, 2 interceptions in the arc.",
  "Struggled between lines vs Rodri screen — subbed at 72'.",
  "Bright in half-spaces, one dangerous curler off target at 74'.",
  "Doubled up by Cucurella + Nico; limited to 22 touches in final third.",
  "Dropped to draw pivot, generated 0.11 xG on limited service.",
  "Introduced late, immediate through-ball threat but no output.",
];

// Build ESP_ENG pack in detail
const espXI = buildXI("ESP", HOME_433, ESP_NAMES, ESP_RATINGS, ESP_NOTES);
const engXI = buildXI("ENG", AWAY_433, ENG_NAMES, ENG_RATINGS, ENG_NOTES);

const ESP_ENG_PACK: IntelPack = {
  summary:
    "Spain's 3-box-3 in possession is pulling England's double pivot out of shape. Left half-space (Pedri/Cucurella) is the primary progression channel. England's mid-block leaks between the CM and RB — 68% of Spain's final-third entries came through that seam.",
  homeXI: espXI,
  awayXI: engXI,
  passEdges: { home: defaultEdges(espXI), away: defaultEdges(engXI) },
  pressingTraps: [
    { id: "t1", x: 32, y: 22, w: 22, h: 22, intensity: 0.85, team: "home", label: "LEFT-HS TRAP", note: "Spain baits England's RB forward, Pedri springs the trap between LB and RCM." },
    { id: "t2", x: 42, y: 55, w: 20, h: 25, intensity: 0.7, team: "home", label: "PIVOT ISOLATION", note: "Rodri screens Bellingham; Merino jumps to force a sideways ball." },
    { id: "t3", x: 62, y: 30, w: 18, h: 30, intensity: 0.55, team: "away", label: "SAKA COUNTER LANE", note: "England's transition outlet — 3 fast breaks originated here." },
    { id: "t4", x: 80, y: 45, w: 16, h: 20, intensity: 0.9, team: "home", label: "FINAL-THIRD OVERLOAD", note: "Yamal + Carvajal 2v1 vs Shaw; xG spike zone (0.42 in last 15')." },
  ],
};

// Lightweight generator for the other matches
function genericPack(matchId: string, opts: { summary: string; traps: PressingTrap[] }): IntelPack {
  const ds = getMatchDataset(matchId);
  const homeCode = ds?.match.home.code ?? "HOM";
  const awayCode = ds?.match.away.code ?? "AWY";
  // Try to seed a few known names from the dataset's shots.
  const shotPlayers = (ds?.shots ?? []).reduce<Record<"home" | "away", string[]>>(
    (acc, s) => {
      if (!acc[s.team].includes(s.player)) acc[s.team].push(s.player);
      return acc;
    },
    { home: [], away: [] },
  );
  const fillNames = (code: string, seeds: string[]) => {
    const roles = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW"];
    const out: string[] = [];
    for (let i = 0; i < 11; i++) {
      if (i >= 8 && seeds[i - 8]) out.push(seeds[i - 8]);
      else out.push(`${code} ${roles[i]}`);
    }
    return out;
  };
  const homeNames = fillNames(homeCode, shotPlayers.home);
  const awayNames = fillNames(awayCode, shotPlayers.away);
  const ratings = [7.0, 6.9, 7.1, 7.0, 6.8, 7.3, 7.2, 7.4, 7.5, 6.8, 7.3];
  const notes = new Array(11).fill("Steady contribution, no standout events flagged by model.");
  const homeXI = buildXI(homeCode, HOME_433, homeNames, ratings, notes);
  const awayXI = buildXI(awayCode, AWAY_433, awayNames, ratings, notes);
  return {
    summary: opts.summary,
    homeXI,
    awayXI,
    passEdges: { home: defaultEdges(homeXI), away: defaultEdges(awayXI) },
    pressingTraps: opts.traps,
  };
}

const PACKS: Record<string, IntelPack> = {
  "por-esp-r16": ESP_ENG_PACK,
  "can-mar-r16": genericPack("can-mar-r16", {
    summary:
      "Open, transitional game. Canada's build-up shifts to a 3-2-5 with David pinning the full-back; Morocco counters through central duels (61% won) with recovery-to-shot averaging 6.2s.",
    traps: [
      { id: "t1", x: 78, y: 20, w: 18, h: 24, intensity: 0.8, team: "home", label: "DAVID ISO", note: "Canada isolates the full-back in the left channel — repeat 1v1 threat zone." },
      { id: "t2", x: 20, y: 52, w: 22, h: 20, intensity: 0.75, team: "away", label: "OUNAHI SPRINT LANE", note: "Morocco's counter outlet, 3 fast breaks originated here." },
      { id: "t3", x: 48, y: 50, w: 22, h: 24, intensity: 0.65, team: "away", label: "CENTRAL DUEL ZONE", note: "Morocco winning 61% of duels; primary counter trigger." },
    ],
  }),
  "bra-nor-r16": genericPack("bra-nor-r16", {
    summary:
      "Pre-match model: Brazil expected to hold 60% possession vs a Norwegian 4-3-3 anchored around Haaland. Key battleground is the space in behind Brazil's back line for direct balls.",
    traps: [
      { id: "t1", x: 55, y: 50, w: 22, h: 20, intensity: 0.7, team: "home", label: "VINÍCIUS POCKET", note: "Between NOR's midfield and back four — projected xA hotspot." },
      { id: "t2", x: 78, y: 40, w: 20, h: 22, intensity: 0.65, team: "away", label: "HAALAND RUN LANE", note: "Behind Brazil's centre-backs — Norway's primary counter trigger." },
    ],
  }),
  "arg-egy-r16": genericPack("arg-egy-r16", {
    summary:
      "Pre-match model: Argentina expected to hold 62% possession vs an Egyptian 5-3-2 mid-block. Key battleground is between-lines space that Messi will occupy as a free 10.",
    traps: [
      { id: "t1", x: 55, y: 50, w: 22, h: 20, intensity: 0.7, team: "home", label: "MESSI POCKET", note: "Between EGY's back-five and midfield — projected xA hotspot." },
      { id: "t2", x: 30, y: 50, w: 22, h: 30, intensity: 0.5, team: "away", label: "EGY MID-BLOCK", note: "5-3-2 block designed to compress central lanes." },
      { id: "t3", x: 78, y: 30, w: 18, h: 24, intensity: 0.6, team: "away", label: "SALAH COUNTER LANE", note: "Egypt's outlet — targets Argentina's right-back on transitions." },
    ],
  }),
};


export function getIntelPack(matchId: string): IntelPack | undefined {
  return PACKS[matchId];
}
