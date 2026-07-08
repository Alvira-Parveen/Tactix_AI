import { useMemo } from "react";
import { useMatchData } from "@/lib/match-context";
import type { ShotEvent, MatchDataset } from "@/lib/match-data";
import { ratePlayer } from "@/lib/ratings";

// ─── Evidence-based rating engine ─────────────────────────────────────────
// Ratings are derived from observable metrics in the dataset (shot volume,
// xG, xG overperformance, goals) and combined with per-player tactical
// context notes. This keeps every rating explainable: each row exposes the
// numeric metrics AND the tactical reasons that produced the score.

type PlayerRow = {
  player: string;
  team: "home" | "away";
  teamCode: string;
  rating: number; // 0–10
  shots: number;
  sot: number;
  goals: number;
  xG: number;
  xGDelta: number; // goals - xG (finishing quality vs expected)
  keyShot: ShotEvent | undefined;
  reasons: string[];
};

// Contextual tactical notes tied to what the AI feed is already showing.
// Keyed by matchId → player name.
const CONTEXT_NOTES: Record<string, Record<string, string[]>> = {
  "por-esp-r16": {
    Ronaldo: [
      "Winning first contact on 62% of near-post corners — primary set-piece threat",
      "Aerial duel dominance in the six-yard box",
    ],
    "B. Fernandes": ["Controls tempo from between the lines"],
    "B. Silva": ["Late-run xG of 0.42 punished Spain's pivot being pulled out"],
    Leão: ["Wide isolation vs Spain's right-back — 1v1 threat lane"],
    Yamal: [
      "Progressive carries into the box triggered danger-zone spikes",
      "Occupies Portugal's isolated left-back on switches of play",
    ],
    Pedri: ["Controls tempo from the left half-space during territory phases"],
    Nico: ["Long-shot attempt reduced possession quality (xG 0.09)"],
    Merino: ["Off-target long-range effort reflects forced shot selection"],
  },
  "can-mar-r16": {
    David: ["Pinned Morocco's full-back inside the half-space to open the goal lane"],
    Buchanan: ["On-target strike from a rebound in the pressing trap zone"],
    Larin: ["Blocked shot from a low-quality position (xG 0.09)"],
    "En-Nesyri": [
      "Converted a fast-break from a 6.2s recovery-to-shot sequence",
      "Isolated Canada's back line on the counter",
    ],
    Ziyech: ["Two shots on target from the left channel"],
    Ounahi: ["Off-target attempt — Morocco's press bypass produced a rushed finish"],
  },
};



function buildRatings(dataset: MatchDataset): PlayerRow[] {
  const notes = CONTEXT_NOTES[dataset.match.id] ?? {};
  const byPlayer = new Map<string, PlayerRow>();

  for (const shot of dataset.shots) {
    const key = shot.player;
    const teamCode = shot.team === "home" ? dataset.match.home.code : dataset.match.away.code;
    const existing = byPlayer.get(key) ?? {
      player: key,
      team: shot.team,
      teamCode,
      rating: 0,
      shots: 0,
      sot: 0,
      goals: 0,
      xG: 0,
      xGDelta: 0,
      keyShot: undefined as ShotEvent | undefined,
      reasons: [] as string[],
    };
    existing.shots += 1;
    existing.xG += shot.xG;
    if (shot.outcome === "goal") existing.goals += 1;
    if (shot.outcome === "goal" || shot.outcome === "on-target") existing.sot += 1;
    if (!existing.keyShot || shot.xG > existing.keyShot.xG) existing.keyShot = shot;
    byPlayer.set(key, existing);
  }

  const rows: PlayerRow[] = [];
  for (const row of byPlayer.values()) {
    row.xG = Math.round(row.xG * 100) / 100;
    row.xGDelta = Math.round((row.goals - row.xG) * 100) / 100;
    const { rating, metricReasons } = ratePlayer(row);
    row.rating = rating;
    row.reasons = [...metricReasons, ...(notes[row.player] ?? [])];
    rows.push(row);
  }

  rows.sort((a, b) => b.rating - a.rating);
  return rows;
}

function ratingTone(rating: number) {
  if (rating >= 8) return "text-primary";
  if (rating >= 7) return "text-foreground";
  if (rating >= 6) return "text-muted";
  return "text-danger";
}

export function PlayerRatings() {
  const dataset = useMatchData();
  const rows = useMemo(() => buildRatings(dataset), [dataset]);

  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
          Explainable Player Ratings
        </div>
        <p className="mt-2 text-xs text-muted">
          Ratings appear once shot-level events are recorded. This fixture has no on-ball events yet.
        </p>
      </div>
    );
  }

  const top = rows.slice(0, 5);

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Explainable Player Ratings
        </span>
        <span className="font-mono text-[10px] text-primary">Evidence · Live</span>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {top.map((row) => (
          <li key={row.player} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{row.player}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {row.teamCode}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                  {row.shots} shot{row.shots === 1 ? "" : "s"} · {row.sot} on target · {row.xG.toFixed(2)} xG
                  {row.goals > 0 ? ` · ${row.goals}G` : ""}
                </div>
              </div>
              <div className={`font-mono text-2xl font-medium ${ratingTone(row.rating)}`}>
                {row.rating.toFixed(1)}
              </div>
            </div>

            {row.reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {row.reasons.map((reason, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-snug text-muted">
                    <span className="mt-[3px] inline-block h-1 w-1 flex-shrink-0 rounded-full bg-primary/60" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] leading-relaxed text-muted/80">
        Ratings anchor at 6.5 and adjust from observable evidence: goals, xG created,
        finishing vs expected, and shot accuracy — combined with tactical role context.
      </p>
    </div>
  );
}
