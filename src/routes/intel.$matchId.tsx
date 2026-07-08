import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMatchDataset } from "@/lib/match-data";
import { getIntelPack, type PlayerNode, type PressingTrap, type PassEdge } from "@/lib/tactical-intel";
import { ShareButton } from "@/components/tactix/ShareButton";

export const Route = createFileRoute("/intel/$matchId")({
  loader: ({ params }) => {
    const dataset = getMatchDataset(params.matchId);
    if (!dataset) throw notFound();
    const intel = getIntelPack(params.matchId);
    if (!intel) throw new Error("Tactical intelligence pack unavailable for this match.");
    return { dataset, intel };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Tactical Intelligence — TACTIX AI" }, { name: "robots", content: "noindex" }] };
    const { match } = loaderData.dataset;
    const title = `Tactical Intel · ${match.home.name} vs ${match.away.name} — TACTIX AI`;
    const description = `Heatmaps, pass networks, pressing traps and per-player scouting notes for ${match.home.name} vs ${match.away.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: IntelDashboard,
  notFoundComponent: IntelNotFound,
  errorComponent: IntelError,
});

type Section = "heatmap" | "network" | "press" | "scouting";
type TeamKey = "home" | "away";

function IntelDashboard() {
  const { dataset, intel } = Route.useLoaderData();
  const { match } = dataset;
  const [section, setSection] = useState<Section>("heatmap");
  const [team, setTeam] = useState<TeamKey>("home");

  const xi = team === "home" ? intel.homeXI : intel.awayXI;
  const teamName = team === "home" ? match.home.name : match.away.name;
  const edges = team === "home" ? intel.passEdges.home : intel.passEdges.away;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30">
      <header className="border-b border-border bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Tactical Intelligence · {match.stage}
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {match.home.name} <span className="text-muted">vs</span> {match.away.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton
              title={`Tactical Intel · ${match.home.name} vs ${match.away.name}`}
              text="AI tactical intelligence on TACTIX AI"
            />
            <Link
              to="/match/$matchId"
              params={{ matchId: match.id }}
              className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
            >
              ← Live Dashboard
            </Link>
            <Link
              to="/"
              className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              Match Hub
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 p-6">
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded border border-border bg-surface/40 p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">AI Summary</div>
            <p className="text-sm leading-relaxed text-foreground/90">{intel.summary}</p>
          </div>

          <nav className="mt-4 flex flex-col gap-1">
            {(
              [
                ["heatmap", "Player Heatmaps"],
                ["network", "Pass Network"],
                ["press", "Pressing Traps"],
                ["scouting", "Scouting Notes"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`rounded border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  section === key
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-surface/40 text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {section !== "press" && section !== "scouting" && (
            <div className="mt-4 flex overflow-hidden rounded border border-border">
              <button
                type="button"
                onClick={() => setTeam("home")}
                className={`flex-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                  team === "home" ? "bg-primary/20 text-primary" : "bg-surface/40 text-muted"
                }`}
              >
                {match.home.code}
              </button>
              <button
                type="button"
                onClick={() => setTeam("away")}
                className={`flex-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                  team === "away" ? "bg-primary/20 text-primary" : "bg-surface/40 text-muted"
                }`}
              >
                {match.away.code}
              </button>
            </div>
          )}
        </aside>

        <section className="col-span-12 lg:col-span-9">
          {section === "heatmap" && (
            <HeatmapView xi={xi} teamName={teamName} teamKey={team} matchId={match.id} />
          )}
          {section === "network" && <PassNetworkView xi={xi} edges={edges} teamName={teamName} teamKey={team} />}
          {section === "press" && <PressingTrapsView traps={intel.pressingTraps} match={match} matchId={match.id} />}
          {section === "scouting" && (
            <ScoutingView home={{ name: match.home.name, xi: intel.homeXI }} away={{ name: match.away.name, xi: intel.awayXI }} matchId={match.id} />
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Pitch primitive ───────────────────────────────────────────────────────
function Pitch({ children, flip = false }: { children: React.ReactNode; flip?: boolean }) {
  // 100 x 66 unit pitch. Home attacks right; when flip, mirror horizontally.
  return (
    <svg viewBox="0 0 100 66" className="w-full rounded border border-border bg-[oklch(0.22_0.02_150)]" preserveAspectRatio="xMidYMid meet">
      <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined}>
        {/* Outer */}
        <rect x="1" y="1" width="98" height="64" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        <line x1="50" y1="1" x2="50" y2="65" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        <circle cx="50" cy="33" r="7" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        {/* Boxes */}
        <rect x="1" y="16" width="14" height="34" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        <rect x="85" y="16" width="14" height="34" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        <rect x="1" y="25" width="5" height="16" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        <rect x="94" y="25" width="5" height="16" fill="none" stroke="oklch(0.5 0.02 150 / 0.4)" strokeWidth="0.3" />
        {children}
      </g>
    </svg>
  );
}

// Coordinate maps: player x/y (0..100 / 0..100) → pitch (100 / 66)
const px = (x: number) => x;
const py = (y: number) => (y / 100) * 66;

// ─── Legend primitives ─────────────────────────────────────────────────────
function Legend({ items }: { items: { swatch: React.ReactNode; label: string; hint?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-border bg-background/40 px-3 py-2 text-[11px] text-muted">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2" title={it.hint}>
          <span className="inline-flex size-4 shrink-0 items-center justify-center">{it.swatch}</span>
          <span>
            <span className="text-foreground/90">{it.label}</span>
            {it.hint ? <span className="ml-1 text-muted">— {it.hint}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function HeatSwatch() {
  return (
    <span
      className="inline-block h-3 w-6 rounded-sm"
      style={{
        background:
          "linear-gradient(to right, oklch(0.7 0.16 60 / 0.25), oklch(0.72 0.17 45 / 0.6), oklch(0.75 0.18 25 / 0.95))",
      }}
    />
  );
}

function DotSwatch({ color = "oklch(0.85 0.02 150)" }: { color?: string }) {
  return <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />;
}

function LineSwatch({ thin }: { thin?: boolean }) {
  return (
    <span
      className="inline-block h-0.5 w-6 rounded-full"
      style={{ background: "oklch(0.75 0.15 220)", opacity: thin ? 0.35 : 0.9, transform: thin ? "scaleY(0.6)" : undefined }}
    />
  );
}

function ZoneSwatch({ color, opacity = 0.4 }: { color: string; opacity?: number }) {
  return (
    <span
      className="inline-block h-3 w-4 rounded-sm border"
      style={{ background: color, opacity, borderColor: color }}
    />
  );
}

// ─── "What this means" AI explainer ────────────────────────────────────────
type Explainer = { term: string; blurb: string };

function AIExplainerRow({ item, context }: { item: Explainer; context: string }) {
  const [blurb, setBlurb] = useState(item.blurb);
  const [state, setState] = useState<"idle" | "loading" | "ai" | "fallback">("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState("loading");
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: item.term, context }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { blurb?: string; error?: string };
      })
      .then((data) => {
        if (cancelled) return;
        if (data.blurb) {
          setBlurb(data.blurb);
          setState("ai");
        } else {
          setState("fallback");
        }
      })
      .catch(() => {
        if (!cancelled) setState("fallback");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [item.term, context]);

  return (
    <div className="rounded border border-border/60 bg-background/40 p-2">
      <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground/90">
        <span>{item.term}</span>
        {state === "loading" && <span className="text-muted">· generating…</span>}
        {state === "ai" && <span className="text-primary">· live AI</span>}
      </dt>
      <dd className="mt-1 text-xs leading-relaxed text-muted">{blurb}</dd>
    </div>
  );
}

function WhatThisMeans({ items, context }: { items: Explainer[]; context: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded border border-primary/25 bg-primary/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/20 font-mono text-[9px] font-bold text-primary">
            AI
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">What this means · Live AI</span>
        </div>
        <span className="font-mono text-[10px] text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <dl className="grid gap-2 border-t border-primary/15 p-3 sm:grid-cols-2">
          {items.map((it) => (
            <AIExplainerRow key={it.term} item={it} context={context} />
          ))}
        </dl>
      )}
    </div>
  );
}

const HEATMAP_EXPLAINERS: Explainer[] = [
  { term: "Presence heat", blurb: "Density of a player's positional samples over the last 15 minutes. Warmer = more time spent there. It's location frequency, not action count." },
  { term: "Player node", blurb: "Weighted-average position of the player's touches. It shows their operating base — not where they actually made every intervention." },
  { term: "Dimmed nodes", blurb: "Non-focused players when you isolate one. The pitch layout still reflects real positions so you can read the shape around them." },
  { term: "Touches (t)", blurb: "All ball contacts — passes, carries, duels, shots. Higher counts usually mean more involvement, not necessarily better performance." },
  { term: "Rating", blurb: "AI post-hoc score (0–10) blending xG contribution, pass value, duels won, and disciplinary events. Directional, not authoritative." },
];

const NETWORK_EXPLAINERS: Explainer[] = [
  { term: "Node size", blurb: "Scales with total touches. Larger nodes had more of the ball; deep-lying playmakers and CBs often dominate here." },
  { term: "Edge thickness", blurb: "Pass volume between the two players. Thick edges expose your team's real build-up channels — often different from the tactics board." },
  { term: "Edge opacity", blurb: "Reinforces the same weight. Faint lines are low-frequency pairings — pressing them tends to break the network faster." },
  { term: "Layout", blurb: "Positions are average-touch coordinates, so shape distortion (e.g. one CB dragged wide) is signal about how the game was actually played." },
  { term: "Top pairs list", blurb: "The six highest-volume passing links. Compare against expected roles — surprises here are usually where the opposition should press." },
];

const PRESS_EXPLAINERS: Explainer[] = [
  { term: "Zone color", blurb: "Team of origin: warm = home, cool = away. It's the team creating or exploiting the zone, not who defends it." },
  { term: "Zone opacity", blurb: "Model confidence × recent recurrence. Faded zones are weaker signals; deep-filled zones are repeatable, high-value patterns." },
  { term: "Selected state", blurb: "Click a zone to isolate it and pull up the tactical note. Selection changes only the highlight — the underlying signal is unchanged." },
  { term: "Pressing trap", blurb: "A staged high press engineered to force the ball into a numerical trap. Success = turnover in the middle third within 4s." },
  { term: "Threat zone", blurb: "An attacking overload area where xG per possession is elevated. Repeat entries here are the primary chance-creation channel." },
];

// ─── Heatmap view ───────────────────────────────────────────────────────────
function HeatmapView({
  xi,
  teamName,
  teamKey,
  matchId,
}: {
  xi: PlayerNode[];
  teamName: string;
  teamKey: TeamKey;
  matchId: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? xi.find((p) => p.id === selectedId) : null;
  const heatSource = selected ? [selected] : xi;
  const flip = teamKey === "away";

  const askPrompts = selected
    ? [
        `Analyze ${selected.name}'s (${selected.role}) impact on this match. Focus on positioning, touches (${selected.touches}), and tactical role.`,
        `Where is ${selected.name} operating on the pitch, and how does that heatmap shape ${teamName}'s attack?`,
        `What are ${selected.name}'s biggest tactical weaknesses the opposition can exploit?`,
      ]
    : [];

  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Player Heatmaps</div>
          <div className="text-sm text-muted">
            {teamName} · {selected ? selected.name : "Click a player to focus + ask AI"}
          </div>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded border border-border bg-surface/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
          >
            Show all
          </button>
        )}
      </div>

      <Pitch flip={flip}>
        <defs>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.75 0.18 25)" stopOpacity="0.85" />
            <stop offset="60%" stopColor="oklch(0.7 0.16 60)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.7 0.16 60)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {heatSource.flatMap((p) =>
          p.heat.map((h, i) => (
            <circle
              key={`${p.id}-h-${i}`}
              cx={px(h.x)}
              cy={py(h.y)}
              r={selected ? 10 : 6}
              fill="url(#heat)"
              opacity={h.w * (selected ? 1 : 0.5)}
            />
          )),
        )}
        {xi.map((p) => (
          <g
            key={p.id}
            transform={`translate(${px(p.x)} ${py(p.y)})`}
            onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
            style={{ cursor: "pointer" }}
          >
            <title>{`#${p.num} ${p.name} · ${p.role} · ${p.touches} touches · rating ${p.rating.toFixed(1)}`}</title>
            <circle
              r="2.2"
              fill={selected && selected.id !== p.id ? "oklch(0.4 0.02 150)" : "oklch(0.85 0.02 150)"}
              stroke="oklch(0.2 0.02 150)"
              strokeWidth="0.3"
            />
            <text y="-3" textAnchor="middle" fontSize="2.2" fill="oklch(0.85 0.02 150)" fontFamily="monospace">
              {p.num}
            </text>
          </g>
        ))}
      </Pitch>

      <div className="mt-3">
        <Legend
          items={[
            { swatch: <HeatSwatch />, label: "Presence", hint: "low → high time spent in zone" },
            { swatch: <DotSwatch />, label: "Player node", hint: "avg. position; hover for details" },
            { swatch: <DotSwatch color="oklch(0.4 0.02 150)" />, label: "Dimmed", hint: "not the focused player" },
          ]}
        />
      </div>
      <div className="mt-3">
        <WhatThisMeans items={HEATMAP_EXPLAINERS} context={`Heatmaps and player nodes for ${teamName}`} />
      </div>


      {selected && (
        <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Ask AI about {selected.name}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              #{selected.num} · {selected.role}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {askPrompts.map((q) => (
              <Link
                key={q}
                to="/match/$matchId"
                params={{ matchId }}
                search={{ ask: q }}
                className="rounded border border-border bg-background/40 px-2 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <span className="mr-2 font-mono text-[10px] text-primary">▸</span>
                {q}
              </Link>
            ))}
          </div>
        </div>
      )}


      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {xi.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
            className={`flex items-center justify-between rounded border px-2 py-1.5 text-left text-xs transition-colors ${
              selectedId === p.id
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-surface/40 text-muted hover:text-foreground"
            }`}
          >
            <span className="truncate">
              <span className="mr-1 font-mono">#{p.num}</span>
              {p.name}
            </span>
            <span className="font-mono text-[10px]">{p.touches}t</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Pass Network view ──────────────────────────────────────────────────────
function PassNetworkView({
  xi,
  edges,
  teamName,
  teamKey,
}: {
  xi: PlayerNode[];
  edges: PassEdge[];
  teamName: string;
  teamKey: TeamKey;
}) {
  const nodeById = new Map(xi.map((p) => [p.id, p]));
  const flip = teamKey === "away";

  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <div className="mb-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Pass Network</div>
        <div className="text-sm text-muted">{teamName} · edge weight = pass volume between pair</div>
      </div>
      <Pitch flip={flip}>
        {edges.map((e, i) => {
          const a = nodeById.get(e.from);
          const b = nodeById.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`e-${i}`}
              x1={px(a.x)}
              y1={py(a.y)}
              x2={px(b.x)}
              y2={py(b.y)}
              stroke="oklch(0.75 0.15 220)"
              strokeOpacity={0.25 + e.weight * 0.6}
              strokeWidth={0.3 + e.weight * 1.2}
            >
              <title>{`#${a.num} ${a.name} ↔ #${b.num} ${b.name} · pass volume ${Math.round(e.weight * 100)}`}</title>
            </line>
          );
        })}
        {xi.map((p) => {
          const r = 1.6 + Math.min(4, p.touches / 20);
          return (
            <g key={p.id} transform={`translate(${px(p.x)} ${py(p.y)})`}>
              <title>{`#${p.num} ${p.name} · ${p.role} · ${p.touches} touches`}</title>
              <circle r={r} fill="oklch(0.7 0.15 220 / 0.9)" stroke="oklch(0.2 0.02 150)" strokeWidth="0.3" />
              <text y="0.8" textAnchor="middle" fontSize="1.8" fill="oklch(0.15 0.02 150)" fontFamily="monospace" fontWeight="700">
                {p.num}
              </text>
            </g>
          );
        })}
      </Pitch>
      <div className="mt-3">
        <Legend
          items={[
            { swatch: <DotSwatch color="oklch(0.7 0.15 220)" />, label: "Node size", hint: "= player touches" },
            { swatch: <LineSwatch />, label: "Strong link", hint: "high pass volume between pair" },
            { swatch: <LineSwatch thin />, label: "Weak link", hint: "low pass volume" },
          ]}
        />
      </div>
      <div className="mt-3">
        <WhatThisMeans items={NETWORK_EXPLAINERS} context={`Pass network for ${teamName}`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {[...edges]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 6)
          .map((e, i) => {
            const a = nodeById.get(e.from);
            const b = nodeById.get(e.to);
            if (!a || !b) return null;
            return (
              <div key={i} className="flex items-center justify-between rounded border border-border bg-surface/40 px-2 py-1.5">
                <span className="truncate text-muted">
                  <span className="font-mono">#{a.num}</span> ↔ <span className="font-mono">#{b.num}</span>
                </span>
                <span className="font-mono text-[10px] text-primary">{Math.round(e.weight * 100)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Pressing Traps view ────────────────────────────────────────────────────
function PressingTrapsView({
  traps,
  match,
  matchId,
}: {
  traps: PressingTrap[];
  match: { home: { name: string; code: string }; away: { name: string; code: string } };
  matchId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(traps[0]?.id ?? null);
  const active = traps.find((t) => t.id === activeId) ?? traps[0];
  const activeTeamName = active
    ? active.team === "home"
      ? match.home.name
      : match.away.name
    : "";
  const trapPrompts = active
    ? [
        `Break down the "${active.label}" pressing trap for ${activeTeamName}. What triggers it and how does it work?`,
        `How can the opposition break the "${active.label}" zone (intensity ${Math.round(active.intensity * 100)}%)?`,
        `What tactical adjustments neutralize ${activeTeamName}'s "${active.label}" pattern?`,
      ]
    : [];

  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <div className="mb-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Pressing Traps & Threat Zones</div>
        <div className="text-sm text-muted">Colored zones = high-value defensive triggers or attacking overload areas.</div>
      </div>
      <Pitch>
        {traps.map((t) => {
          const isActive = t.id === active?.id;
          const color = t.team === "home" ? "oklch(0.7 0.18 25)" : "oklch(0.7 0.14 220)";
          const teamCode = t.team === "home" ? match.home.code : match.away.code;
          return (
            <g key={t.id} onClick={() => setActiveId(t.id)} style={{ cursor: "pointer" }}>
              <title>{`${t.label} · ${teamCode} · intensity ${Math.round(t.intensity * 100)}% — ${t.note}`}</title>
              <rect
                x={t.x}
                y={py(t.y - t.h / 2)}
                width={t.w}
                height={py(t.h)}
                fill={color}
                fillOpacity={isActive ? 0.45 : 0.15 + t.intensity * 0.3}
                stroke={color}
                strokeOpacity={isActive ? 1 : 0.6}
                strokeWidth={isActive ? 0.5 : 0.3}
              />
              <text
                x={t.x + t.w / 2}
                y={py(t.y)}
                textAnchor="middle"
                fontSize="2"
                fontFamily="monospace"
                fontWeight="700"
                fill="oklch(0.95 0.02 150)"
              >
                {t.label}
              </text>
            </g>
          );
        })}
      </Pitch>
      <div className="mt-3">
        <Legend
          items={[
            { swatch: <ZoneSwatch color="oklch(0.7 0.18 25)" opacity={0.5} />, label: `${match.home.code} zone`, hint: "home team trap / overload" },
            { swatch: <ZoneSwatch color="oklch(0.7 0.14 220)" opacity={0.5} />, label: `${match.away.code} zone`, hint: "away team trap / overload" },
            { swatch: <ZoneSwatch color="oklch(0.7 0.18 25)" opacity={0.2} />, label: "Low intensity", hint: "faded fill = weaker signal" },
            { swatch: <ZoneSwatch color="oklch(0.7 0.18 25)" opacity={0.9} />, label: "Selected", hint: "click a zone to focus" },
          ]}
        />
      </div>
      <div className="mt-3">
        <WhatThisMeans items={PRESS_EXPLAINERS} context={`${match.home.name} vs ${match.away.name} — pressing traps and threat zones`} />
      </div>


      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {traps.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveId(t.id)}
            className={`rounded border p-3 text-left transition-colors ${
              t.id === active?.id ? "border-primary/50 bg-primary/10" : "border-border bg-surface/40 hover:border-primary/30"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {t.team === "home" ? match.home.code : match.away.code}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/90">{t.note}</p>
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Ask AI about {active.label}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {activeTeamName} · {Math.round(active.intensity * 100)}%
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {trapPrompts.map((q) => (
              <Link
                key={q}
                to="/match/$matchId"
                params={{ matchId }}
                search={{ ask: q }}
                className="rounded border border-border bg-background/40 px-2 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <span className="mr-2 font-mono text-[10px] text-primary">▸</span>
                {q}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scouting Notes view ────────────────────────────────────────────────────
function ScoutingView({
  home,
  away,
  matchId,
}: {
  home: { name: string; xi: PlayerNode[] };
  away: { name: string; xi: PlayerNode[] };
  matchId: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[home, away].map((t) => (
        <div key={t.name} className="rounded border border-border bg-surface/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.name} · Scouting</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">AI rated</div>
          </div>
          <ul className="divide-y divide-border">
            {t.xi.map((p) => {
              const prompt = `Give me a detailed tactical breakdown of ${p.name} (${p.role}, rating ${p.rating.toFixed(1)}, ${p.touches} touches) in this match. Context: ${p.note}`;
              return (
                <li key={p.id} className="py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        <span className="mr-2 font-mono text-[10px] text-muted">#{p.num}</span>
                        {p.name}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">{p.role}</span>
                      </div>
                      <div className="mt-0.5 text-xs leading-relaxed text-foreground/80">{p.note}</div>
                      <Link
                        to="/match/$matchId"
                        params={{ matchId }}
                        search={{ ask: prompt }}
                        className="mt-1.5 inline-flex items-center gap-1 rounded border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="text-primary">▸</span> Ask AI
                      </Link>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-mono text-sm font-bold ${
                          p.rating >= 8 ? "text-primary" : p.rating >= 7 ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {p.rating.toFixed(1)}
                      </div>
                      <div className="font-mono text-[10px] text-muted">{p.touches}t</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Not-found / Error ──────────────────────────────────────────────────────
function IntelNotFound() {
  const { matchId } = Route.useParams();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md text-center">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Intelligence unavailable</div>
        <h1 className="mb-2 text-2xl font-bold">No intel for "{matchId}"</h1>
        <p className="mb-6 text-sm text-muted">This fixture hasn't been ingested by the tactical model yet.</p>
        <Link to="/" className="inline-block rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20">
          ← Back to Match Hub
        </Link>
      </div>
    </div>
  );
}

function IntelError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Intelligence engine error</div>
        <h1 className="mb-2 text-2xl font-bold">Could not compile tactical pack</h1>
        <pre className="mb-6 overflow-x-auto rounded border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger/90">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await router.invalidate();
              reset();
            }}
            className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            ↻ Retry
          </button>
          <Link to="/" className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground">
            ← Match Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
