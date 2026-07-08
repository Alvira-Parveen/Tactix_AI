// ─── Video Analysis Agent ─────────────────────────────────────────────────
// Vision analysis of frames sampled from a clip via Gemini through the
// AI Gateway. Returns both an overall read and a frame-by-frame
// tactical timeline (per-moment phase, press, events, notable players).

import { generateText } from "ai";
import { createAiGatewayProvider } from "@/lib/ai-gateway.server";


export type FrameInput = {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  note?: string;
};

const PHASES = ["build-up", "settled attack", "transition", "defensive block", "set piece", "unknown"] as const;
const ZONES = ["def third", "mid third", "att third", "unknown"] as const;
const PRESS = ["low", "mid", "high", "unknown"] as const;

export type TrackedPlayer = {
  id: string;                 // stable ID across frames, e.g. "H10", "A1"
  team: "home" | "away" | "unknown";
  number: string;             // shirt number as displayed, or "?" if unreadable
  role: string;               // GK / CB / FB / DM / CM / AM / W / ST / unknown
  kit: string;                // kit description, e.g. "light-blue-and-white stripes"
  name?: string;              // only if crest+number unambiguously identifies a real player
  framesSeen: number[];       // 1-based frame indices where this player is visible
  note?: string;              // one-line observation about this player
};

export type PlayerBox = {
  playerId: string;
  // All coords normalized 0..1 relative to the frame (top-left origin).
  x: number;                  // bbox left
  y: number;                  // bbox top
  w: number;                  // bbox width
  h: number;                  // bbox height
  cx: number;                 // centroid x (feet position preferred)
  cy: number;                 // centroid y
  hasBall?: boolean;
};

export type Moment = {
  index: number;
  label: string;
  phase: (typeof PHASES)[number];
  ballZone: (typeof ZONES)[number];
  pressIntensity: (typeof PRESS)[number];
  pressTrigger: string;
  event: string;
  playerIds: string[];
  players: string[];
  boxes: PlayerBox[];         // per-frame boxes for the overlay
  note: string;
};

export type FrameAnalysis = {
  supported: true;
  teamHome: string;
  teamAway: string;
  homeKit: string;
  awayKit: string;
  formationHome: string;
  formationAway: string;
  formationConfidence: "low" | "medium" | "high";
  phase: (typeof PHASES)[number];
  ballZone: (typeof ZONES)[number];
  pressIntensity: (typeof PRESS)[number];
  shape: string;
  keyObservations: string[];
  players: TrackedPlayer[];   // player registry — tracked across frames
  keyPlayers: string[];       // display strings for the top players
  moments: Moment[];
  coachNote: string;
};

export type VideoAnalysis =
  | FrameAnalysis
  | {
      supported: false;
      reason: string;
      externalServiceUrl?: string;
    };

export function analyseVideo(_input: { url: string; startSec?: number; endSec?: number }): VideoAnalysis {
  return {
    supported: false,
    reason:
      "Full-video CV (YOLO / OpenCV / ByteTrack) needs native binaries and long-running GPU workloads — not available on Cloudflare Workers. Use analyseFrame() on sampled frames, or wire an external CV service via CV_SERVICE_URL.",
    externalServiceUrl: process.env.CV_SERVICE_URL,
  };
}

// Schema shape is enforced in-code (normalize + tryParseLoose). Gemini via the
// openai-compatible provider does not accept response_format json_schema, so we
// use generateText and parse/validate the JSON ourselves.

const SYSTEM = `You are an elite football tactical analyst reviewing frames SAMPLED IN ORDER from a single clip. Treat them as a chronological sequence.

Return ONE JSON object with EXACTLY these top-level keys (no others, no markdown, no code fences):
{
  "teamHome": string,           // country/club by kit + crest (e.g. "Argentina", "Cape Verde"). Never "unknown" if kit colours are visible.
  "teamAway": string,
  "homeKit": string,            // short kit description, e.g. "light-blue-and-white stripes, white shorts"
  "awayKit": string,
  "formationHome": string,      // e.g. "4-3-3", "3-5-2", "back four + double pivot"
  "formationAway": string,
  "formationConfidence": "low"|"medium"|"high",  // "high" only if wide-angle frames clearly show all outfielders
  "phase": "build-up"|"settled attack"|"transition"|"defensive block"|"set piece"|"unknown",
  "ballZone": "def third"|"mid third"|"att third"|"unknown",
  "pressIntensity": "low"|"mid"|"high"|"unknown",
  "shape": string,
  "players": [                  // PLAYER REGISTRY — one entry per DISTINCT player seen across all frames. TRACK the same player across frames using kit + shirt number + role + position.
    {
      "id": string,              // stable ID: "H<number>" for home team, "A<number>" for away, e.g. "H10", "A1". If number unreadable, use "H?1", "H?2".
      "team": "home"|"away",
      "number": string,          // shirt number ("10", "1"...) or "?" if unreadable
      "role": string,            // GK / CB / RB / LB / DM / CM / AM / RW / LW / ST / unknown
      "kit": string,             // brief kit description
      "framesSeen": number[],    // 1-based frame indices where this exact player appears
      "note": string             // one-line observation about this player's actions across the clip
    }
  ],
  "moments": [                  // one object PER FRAME in order — MUST have the same length as the number of frames
    {
      "index": number,
      "label": string,
      "phase": "build-up"|"settled attack"|"transition"|"defensive block"|"set piece"|"unknown",
      "ballZone": "def third"|"mid third"|"att third"|"unknown",
      "pressIntensity": "low"|"mid"|"high"|"unknown",
      "pressTrigger": string,
      "event": string,
      "playerIds": string[],
      "boxes": [                 // BOUNDING BOXES for every visible tracked player in THIS frame — normalized 0..1 (top-left origin, x right, y down)
        {
          "playerId": string,     // must match a players[].id
          "x": number, "y": number, "w": number, "h": number,   // bbox in [0,1]
          "cx": number, "cy": number,                           // centroid (prefer feet position, at bottom of bbox)
          "hasBall": boolean       // true if this player is in possession this frame
        }
      ],
      "note": string
    }
  ],
  "keyObservations": string[],   // 4–6 specific tactical bullets across the clip
  "keyPlayers": string[],        // top 3–5 players by impact — reference by ID + role + team, e.g. "H10 CAM (Argentina)"
  "coachNote": string
}

TRACKING RULES (critical)
- Look at ALL frames before writing players[]. The SAME player wearing the SAME kit + SAME shirt number in different frames is ONE registry entry — do NOT duplicate them per frame.
- Assign a stable ID (H<num> / A<num>) once and reuse it in every moment.playerIds and in event strings.
- If a shirt number is not readable in ANY frame, still track the player by role + position + kit and give them "H?1", "H?2", "A?1" etc.
- If the same number could belong to two different people, split them by role/position and use suffixed IDs ("H10a", "H10b").
- framesSeen must list every frame index where that specific player appears.

BOUNDING BOX RULES (critical for overlay)
- For EACH frame, list a "boxes" entry for EVERY player in playerIds — one box per player.
- All coordinates are NORMALIZED to the frame: x, y, w, h, cx, cy are in [0, 1]. Top-left origin. x/w are horizontal, y/h are vertical.
- x,y is the TOP-LEFT of the bbox; w,h is width/height. cx is roughly x+w/2; cy should be near y+h (feet position) so trajectory lines follow the pitch surface.
- Boxes must be tight around the visible player. If a player is only partially visible (edge of frame), clip the box to [0,1] but still emit it.
- If you cannot estimate a box for a player you listed in playerIds, drop them from playerIds for that frame.
- Set hasBall=true for at most ONE player per frame (the one on the ball).

FORMATION RULES
- Infer formations from the widest available frames by counting outfield players per line (defence / midfield / attack). Cross-check across all wide frames.
- Set formationConfidence to "high" only if at least one frame clearly shows the full defensive/midfield line.
- If no frame is wide enough, formation may be "unknown" but formationConfidence must then be "low".

TEAM RULES
- Identify teams by KIT + CREST. Prefer country/club names when the kit is well-known (Argentina light-blue-and-white stripes; Brazil yellow/green; France dark blue; Germany white/black; Man City sky blue; Real Madrid all white; Barcelona blaugrana; Cape Verde blue). Do NOT write "unknown" when a kit is visible.
- Never invent player NAMES, scorelines, or minutes. Shirt NUMBERS are fine when clearly visible.

Return ONLY the JSON object. No prose, no markdown, no code fences.`;

function normEnum<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}
function asString(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function asStringArray(v: unknown, cap = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, cap);
}
function asNumberArray(v: unknown, cap = 32): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : typeof x === "string" ? parseInt(x, 10) : NaN;
    if (Number.isFinite(n) && n > 0) out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

function normalizeTracked(p: unknown, i: number): TrackedPlayer {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const teamRaw = asString(o.team, "unknown").toLowerCase();
  const team: TrackedPlayer["team"] =
    teamRaw === "home" || teamRaw === "a" || teamRaw === "team1" ? "home"
    : teamRaw === "away" || teamRaw === "b" || teamRaw === "team2" ? "away"
    : "unknown";
  const number = asString(o.number, "?");
  const fallbackId = `${team === "away" ? "A" : "H"}${number !== "?" ? number : `?${i + 1}`}`;
  return {
    id: asString(o.id, fallbackId),
    team,
    number,
    role: asString(o.role, "unknown"),
    kit: asString(o.kit, "—"),
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : undefined,
    framesSeen: asNumberArray(o.framesSeen),
    note: typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined,
  };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function normalizeBox(b: unknown): PlayerBox | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const pid = asString(o.playerId ?? o.id, "");
  if (!pid) return null;
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : NaN;
  };
  let x = num(o.x), y = num(o.y), w = num(o.w ?? o.width), h = num(o.h ?? o.height);
  let cx = num(o.cx), cy = num(o.cy);
  // If model gave coords >1 assume pixel or percent — normalize by max ref.
  const maxRef = Math.max(x, y, w, h, cx, cy);
  if (Number.isFinite(maxRef) && maxRef > 1.5) {
    const div = maxRef > 100 ? maxRef : 100; // 0..100 (%) or larger => pixel; scale by max seen
    x /= div; y /= div; w /= div; h /= div; cx /= div; cy /= div;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  x = clamp01(x); y = clamp01(y);
  w = clamp01(w); h = clamp01(h);
  if (w < 0.005 || h < 0.005) return null;
  if (!Number.isFinite(cx)) cx = x + w / 2;
  if (!Number.isFinite(cy)) cy = y + h; // feet
  return {
    playerId: pid,
    x, y, w, h,
    cx: clamp01(cx),
    cy: clamp01(cy),
    hasBall: o.hasBall === true,
  };
}

function normalizeMoment(m: unknown, i: number): Moment {
  const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
  const playerIds = asStringArray(o.playerIds, 8);
  const rawBoxes = Array.isArray(o.boxes) ? o.boxes : Array.isArray(o.bboxes) ? o.bboxes : [];
  const boxes = rawBoxes.map(normalizeBox).filter((b): b is PlayerBox => b !== null).slice(0, 12);
  return {
    index: typeof o.index === "number" && Number.isFinite(o.index) ? o.index : i + 1,
    label: asString(o.label, `Frame ${i + 1}`),
    phase: normEnum(o.phase, PHASES, "unknown"),
    ballZone: normEnum(o.ballZone, ZONES, "unknown"),
    pressIntensity: normEnum(o.pressIntensity, PRESS, "unknown"),
    pressTrigger: asString(o.pressTrigger, "n/a"),
    event: asString(o.event, "—"),
    playerIds: playerIds.length > 0 ? playerIds : boxes.map((b) => b.playerId),
    players: asStringArray(o.players, 4),
    boxes,
    note: asString(o.note, "—"),
  };
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function mode<T extends string>(values: T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const v of values) if (v && v !== "unknown") counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T = fallback;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
}

function normConf(v: unknown): "low" | "medium" | "high" {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "high" || s === "medium" || s === "low" ? s : "low";
}

function normalize(obj: Record<string, unknown>, frameCount: number): FrameAnalysis {
  const rawMoments = Array.isArray(obj.moments)
    ? obj.moments
    : Array.isArray(obj.timeline)
      ? obj.timeline
      : Array.isArray(obj.frames)
        ? obj.frames
        : [];
  const moments = rawMoments.slice(0, Math.max(frameCount, rawMoments.length)).map(normalizeMoment);
  while (moments.length < frameCount) {
    moments.push(normalizeMoment({}, moments.length));
  }

  // Player registry — dedupe by id (a robust fallback to the model's own dedup).
  const rawPlayers = Array.isArray(obj.players)
    ? obj.players
    : Array.isArray(obj.playerRegistry)
      ? obj.playerRegistry
      : Array.isArray(obj.roster)
        ? obj.roster
        : [];
  const seen = new Map<string, TrackedPlayer>();
  rawPlayers.forEach((p, i) => {
    const tp = normalizeTracked(p, i);
    const key = tp.id;
    if (!seen.has(key)) seen.set(key, tp);
    else {
      const existing = seen.get(key)!;
      // merge framesSeen if the model duplicated the same player
      const merged = new Set([...existing.framesSeen, ...tp.framesSeen]);
      existing.framesSeen = Array.from(merged).sort((a, b) => a - b);
      if (!existing.note && tp.note) existing.note = tp.note;
    }
  });
  const players = Array.from(seen.values());

  // Build a display map so moments can render "H10 (Argentina #10 CAM)" from IDs
  const idToDisplay = new Map<string, string>();
  const homeTeam = asString(pick(obj, ["teamHome", "team1", "homeTeam", "teamA"]), "unknown");
  const awayTeam = asString(pick(obj, ["teamAway", "team2", "awayTeam", "teamB"]), "unknown");
  for (const p of players) {
    const team = p.team === "home" ? homeTeam : p.team === "away" ? awayTeam : "unknown";
    const role = p.role && p.role !== "unknown" ? ` ${p.role}` : "";
    const num = p.number && p.number !== "?" ? `#${p.number}` : "#?";
    idToDisplay.set(p.id, `${num} ${team}${role}`.trim());
  }
  // Backfill moment.players from playerIds when the model omitted display strings.
  for (const m of moments) {
    if (m.players.length === 0 && m.playerIds.length > 0) {
      m.players = m.playerIds.map((id) => idToDisplay.get(id) ?? id);
    }
  }

  const derivedPhase = mode(moments.map((m) => m.phase), "unknown");
  const derivedZone = mode(moments.map((m) => m.ballZone), "unknown");
  const derivedPress = mode(moments.map((m) => m.pressIntensity), "unknown");

  return {
    supported: true,
    teamHome: homeTeam,
    teamAway: awayTeam,
    homeKit: asString(pick(obj, ["homeKit", "kitHome"]), "—"),
    awayKit: asString(pick(obj, ["awayKit", "kitAway"]), "—"),
    formationHome: asString(pick(obj, ["formationHome", "formation1", "homeFormation", "formationA"]), "unknown"),
    formationAway: asString(pick(obj, ["formationAway", "formation2", "awayFormation", "formationB"]), "unknown"),
    formationConfidence: normConf(pick(obj, ["formationConfidence", "confidence"])),
    phase: normEnum(pick(obj, ["phase", "overallPhase"]), PHASES, derivedPhase),
    ballZone: normEnum(pick(obj, ["ballZone", "zone"]), ZONES, derivedZone),
    pressIntensity: normEnum(pick(obj, ["pressIntensity", "press"]), PRESS, derivedPress),
    shape: asString(pick(obj, ["shape", "shapeNote"]), "—"),
    keyObservations: asStringArray(pick(obj, ["keyObservations", "observations"])),
    players,
    keyPlayers: asStringArray(pick(obj, ["keyPlayers"]), 6),
    moments,
    coachNote: asString(pick(obj, ["coachNote", "takeaway", "note"]), "—"),
  };
}

function tryParseLoose(raw: string): Record<string, unknown> | null {
  let s = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  s = s.slice(start, end + 1);
  const attempts = [
    s,
    s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"),
    s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " "),
  ];
  for (const c of attempts) {
    try {
      const parsed = JSON.parse(c) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // continue
    }
  }
  return null;
}

export async function analyseFrame(input: FrameInput): Promise<VideoAnalysis> {
  const key = process.env.GATEWAY_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    return { supported: false, reason: "GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY missing on the server — cannot reach the vision model." };
  }

  const frames = (input.imageDataUrls && input.imageDataUrls.length > 0
    ? input.imageDataUrls
    : input.imageDataUrl
      ? [input.imageDataUrl]
      : []
  ).filter((s) => typeof s === "string" && s.length >= 32);

  if (frames.length === 0) {
    return { supported: false, reason: "No image provided." };
  }

  const gateway = createAiGatewayProvider(key);

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [
    {
      type: "text",
      text:
        (input.note ? `Extra context: ${input.note}\n` : "") +
        `You are given ${frames.length} frames sampled in chronological order from the same clip. ` +
        `Produce a per-frame timeline (one moment per frame, ${frames.length} moments total) plus the overall read. ` +
        `Return ONLY the JSON object matching the schema.`,
    },
    ...frames.map((image, i) => [
      { type: "text" as const, text: `Frame ${i + 1} of ${frames.length}:` },
      { type: "image" as const, image },
    ]).flat(),
  ];

  let text = "";
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
    text = result.text ?? "";
  } catch (err) {
    return { supported: false, reason: err instanceof Error ? err.message : "Vision model call failed." };
  }

  const loose = tryParseLoose(text);
  if (loose) return normalize(loose, frames.length);
  return {
    supported: false,
    reason: "Vision model returned no valid JSON. Try a clearer wide-angle clip.",
  };
}
