import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import type { MatchLog, PlayerIntel, SeasonStat } from "@/lib/player-intel";

// ─── Charts for the Players section ──────────────────────────────────────
// - Recent form: line chart of match ratings + goal-contribution bars
// - Season stats: grouped bars (apps / goals / assists) with rating overlay
// - Club vs country: comparative bars

const AXIS = "#7c7c78";
const GRID = "#2a2a2a";

function tooltipStyle() {
  return {
    backgroundColor: "#0d0d0d",
    border: "1px solid #333",
    borderRadius: 4,
    fontSize: 12,
    color: "#eee",
  } as const;
}

// ── Recent form ────────────────────────────────────────────────────────
export function RecentFormChart({ matches }: { matches: MatchLog[] }) {
  const [window, setWindow] = useState<5 | 10>(10);
  const data = useMemo(() => {
    // Server returns newest-first; chart oldest → newest for a natural timeline.
    const slice = matches.slice(0, window).slice().reverse();
    return slice.map((m, i) => ({
      idx: i + 1,
      label: m.opponent ? `${m.home === false ? "@" : "v"} ${m.opponent}` : `M${i + 1}`,
      rating: typeof m.rating === "number" ? m.rating : null,
      goalsAssists: (m.goals ?? 0) + (m.assists ?? 0),
      goals: m.goals ?? 0,
      assists: m.assists ?? 0,
      result: m.result ?? "",
      competition: m.competition ?? "",
    }));
  }, [matches, window]);

  if (matches.length === 0) return null;

  const hasRatings = data.some((d) => d.rating !== null);

  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Recent form</h3>
        <div className="flex gap-1 rounded border border-border p-0.5">
          {[5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWindow(n as 5 | 10)}
              disabled={n > matches.length}
              className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                window === n ? "bg-primary/20 text-primary" : "text-muted hover:text-foreground"
              } disabled:opacity-30`}
            >
              Last {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          {hasRatings ? (
            <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 24 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis domain={[4, 10]} tick={{ fill: AXIS, fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Line
                type="monotone"
                dataKey="rating"
                name="Match rating"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22d3ee" }}
                connectNulls
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 24 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis tick={{ fill: AXIS, fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
              <Bar dataKey="goals" name="Goals" fill="#22d3ee" />
              <Bar dataKey="assists" name="Assists" fill="#a78bfa" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted">
        {hasRatings ? "Match rating (0–10) across selected window." : "Goal contributions per match (ratings not available)."}
      </p>
    </div>
  );
}

// ── Season timeline ────────────────────────────────────────────────────
export function SeasonChart({ seasons }: { seasons: SeasonStat[] }) {
  const [metric, setMetric] = useState<"contrib" | "rating">("contrib");
  const data = useMemo(() => {
    return seasons
      .slice()
      .reverse()
      .map((s) => ({
        season: s.season,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        apps: s.apps ?? 0,
        rating: typeof s.rating === "number" ? s.rating : null,
        club: s.club ?? "",
      }));
  }, [seasons]);

  if (seasons.length === 0) return null;
  const hasRatings = data.some((d) => d.rating !== null);

  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Season timeline</h3>
        <div className="flex gap-1 rounded border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMetric("contrib")}
            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              metric === "contrib" ? "bg-primary/20 text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            Goals + assists
          </button>
          <button
            type="button"
            onClick={() => setMetric("rating")}
            disabled={!hasRatings}
            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              metric === "rating" ? "bg-primary/20 text-primary" : "text-muted hover:text-foreground"
            } disabled:opacity-30`}
          >
            Avg rating
          </button>
        </div>
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          {metric === "contrib" ? (
            <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 24 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
              <XAxis dataKey="season" tick={{ fill: AXIS, fontSize: 10 }} />
              <YAxis tick={{ fill: AXIS, fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
              <Bar dataKey="goals" name="Goals" stackId="c" fill="#22d3ee" />
              <Bar dataKey="assists" name="Assists" stackId="c" fill="#a78bfa" />
              <Bar dataKey="apps" name="Apps" fill="#3f3f46" />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 24 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
              <XAxis dataKey="season" tick={{ fill: AXIS, fontSize: 10 }} />
              <YAxis domain={[4, 10]} tick={{ fill: AXIS, fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Line type="monotone" dataKey="rating" name="Avg rating" stroke="#facc15" strokeWidth={2} dot={{ r: 3, fill: "#facc15" }} connectNulls />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Club vs country ────────────────────────────────────────────────────
export function ClubVsCountryChart({ intel }: { intel: PlayerIntel }) {
  const cv = intel.clubVsCountry;
  if (!cv || (!cv.club && !cv.country)) return null;
  const data = [
    { key: "Apps", club: cv.club?.apps ?? 0, country: cv.country?.apps ?? 0 },
    { key: "Goals", club: cv.club?.goals ?? 0, country: cv.country?.goals ?? 0 },
    { key: "Assists", club: cv.club?.assists ?? 0, country: cv.country?.assists ?? 0 },
  ];
  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Club vs national team</h3>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="key" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
            <Bar dataKey="club" name="Club" fill="#22d3ee" />
            <Bar dataKey="country" name={intel.international?.team ?? "Country"} fill="#a78bfa" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Multi-player comparison chart ──────────────────────────────────────
export function ComparisonBars({
  players,
  metric,
}: {
  players: { name: string; intel: PlayerIntel }[];
  metric: "goals" | "assists" | "apps";
}) {
  const data = players.map((p) => ({
    name: p.intel.fullName ?? p.name,
    value: p.intel.careerStats?.[metric] ?? 0,
  }));
  const COLORS = ["#22d3ee", "#a78bfa", "#facc15", "#f97316"];
  const label = metric[0].toUpperCase() + metric.slice(1);
  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Career {label}</h3>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 10 }} interval={0} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle()} />
            <Bar dataKey="value" name={label}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ComparisonSeasonLines({
  players,
}: {
  players: { name: string; intel: PlayerIntel }[];
}) {
  // Align on season labels. Build a set of all seasons present.
  const allSeasons = Array.from(
    new Set(players.flatMap((p) => p.intel.seasonStats?.map((s) => s.season) ?? [])),
  ).sort();
  if (allSeasons.length === 0) return null;

  const data = allSeasons.map((season) => {
    const row: Record<string, string | number> = { season };
    for (const p of players) {
      const s = p.intel.seasonStats?.find((x) => x.season === season);
      row[p.intel.fullName ?? p.name] = (s?.goals ?? 0) + (s?.assists ?? 0);
    }
    return row;
  });
  const COLORS = ["#22d3ee", "#a78bfa", "#facc15", "#f97316"];

  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Goals + assists per season</h3>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="season" tick={{ fill: AXIS, fontSize: 10 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
            {players.map((p, i) => (
              <Line
                key={p.name}
                type="monotone"
                dataKey={p.intel.fullName ?? p.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
