// Shared client-side helpers for the Players section.
// Types mirror the server-side validation in src/routes/api/player-intel.ts.

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

// Validate a player name client-side before we hit the API. Mirrors the
// server-side rules so we can show inline errors immediately.
export function validatePlayerName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  if (trimmed.length < 2) return { ok: false, error: "Enter at least 2 characters" };
  if (trimmed.length > 80) return { ok: false, error: "Name is too long" };
  if (!/[a-zA-Z\u00C0-\u024F\u0400-\u04FF]/.test(trimmed)) {
    return { ok: false, error: "Name must contain letters" };
  }
  // Reject anything with control chars — sanitize client-side too.
  if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) {
    return { ok: false, error: "Name contains invalid characters" };
  }
  return { ok: true, value: trimmed };
}

export async function fetchPlayerIntel(name: string, hint = ""): Promise<PlayerIntel> {
  const validation = validatePlayerName(name);
  if (!validation.ok) throw new Error(validation.error);

  const res = await fetch("/api/player-intel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: validation.value, hint: hint.slice(0, 120) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  if (!data || typeof data.intel !== "object" || data.intel === null) {
    throw new Error("Invalid response");
  }
  return data.intel as PlayerIntel;
}

// Confidence-aware guard: is there enough data to render historical stats?
export function hasHistoricalStats(intel: PlayerIntel): boolean {
  if (intel.unknown) return false;
  if (intel.dataConfidence === "insufficient") return false;
  return (intel.seasonStats?.length ?? 0) > 0 || (intel.recentMatches?.length ?? 0) > 0;
}
