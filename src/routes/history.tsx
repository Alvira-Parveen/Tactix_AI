import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HISTORICAL_MATCHUPS, PLAYER_MATCHUPS, type HistoricalMatchup, type PlayerMatchup, type EraStat } from "@/lib/history-data";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historical Intelligence — TACTIX AI" },
      {
        name: "description",
        content:
          "Compare national teams across eras — possession, pressing, xG, and tactical evolution. Spain 2010 vs 2026, Brazil 2002 vs 2026, and more.",
      },
      { property: "og:title", content: "Historical Intelligence — TACTIX AI" },
      {
        property: "og:description",
        content:
          "Cross-era tactical comparisons: possession, PPDA, xG, and structural change over time.",
      },
    ],
  }),
  component: HistoryDashboard,
});

type Tab = "teams" | "players";

function HistoryDashboard() {
  const [tab, setTab] = useState<Tab>("teams");
  const [teamId, setTeamId] = useState<string>(HISTORICAL_MATCHUPS[0].id);
  const [playerId, setPlayerId] = useState<string>(PLAYER_MATCHUPS[0].id);
  const activeTeam = HISTORICAL_MATCHUPS.find((m) => m.id === teamId) ?? HISTORICAL_MATCHUPS[0];
  const activePlayer = PLAYER_MATCHUPS.find((m) => m.id === playerId) ?? PLAYER_MATCHUPS[0];

  return (
    <div className="theme-cream min-h-screen font-sans selection:bg-foreground/10">
      <header className="border-b border-border bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Historical Intelligence · dream matchups
            </div>
            <h1 className="text-xl font-bold tracking-tight">Cross-era tactical comparisons</h1>
            <p className="mt-1 max-w-xl text-xs text-muted">
              Iconic World-Cup-winning sides and legendary players simulated head-to-head. Different eras, same pitch.
            </p>
          </div>
          <Link
            to="/"
            className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            Match Hub
          </Link>
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-1 px-6 pb-3">
          {(["teams", "players"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                tab === t ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {t === "teams" ? "Teams" : "Players"}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 p-6">
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded border border-border bg-surface/40 p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">
              {tab === "teams" ? "Team matchups" : "Player matchups"}
            </div>
            <nav className="flex flex-col gap-1">
              {tab === "teams"
                ? HISTORICAL_MATCHUPS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTeamId(m.id)}
                      className={`rounded border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        m.id === teamId ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted hover:text-foreground"
                      }`}
                    >
                      {m.title}
                    </button>
                  ))
                : PLAYER_MATCHUPS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPlayerId(m.id)}
                      className={`rounded border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        m.id === playerId ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted hover:text-foreground"
                      }`}
                    >
                      {m.title}
                    </button>
                  ))}
            </nav>
          </div>
        </aside>

        <section className="col-span-12 space-y-4 lg:col-span-9">
          {tab === "teams" ? (
            <>
              <MatchupHeader title={activeTeam.title} summary={activeTeam.summary} />
              <div className="grid gap-4 md:grid-cols-2">
                <EraCard era={activeTeam.a} tone="a" />
                <EraCard era={activeTeam.b} tone="b" />
              </div>
              <StatCompare aLabel={`${activeTeam.a.team} ${activeTeam.a.year}`} bLabel={`${activeTeam.b.team} ${activeTeam.b.year}`} stats={activeTeam.stats} />
              <Verdict text={activeTeam.verdict} />
            </>
          ) : (
            <>
              <MatchupHeader title={activePlayer.title} summary={activePlayer.summary} />
              <div className="grid gap-4 md:grid-cols-2">
                <PlayerCard era={activePlayer.a} tone="a" />
                <PlayerCard era={activePlayer.b} tone="b" />
              </div>
              <StatCompare aLabel={`${activePlayer.a.name} · ${activePlayer.a.year}`} bLabel={`${activePlayer.b.name} · ${activePlayer.b.year}`} stats={activePlayer.stats} />
              <Verdict text={activePlayer.verdict} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Verdict({ text }: { text: string }) {
  return (
    <div className="rounded border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">Model verdict</div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

function PlayerCard({ era, tone }: { era: PlayerMatchup["a"]; tone: "a" | "b" }) {
  const accent = tone === "a" ? "border-primary/40 bg-primary/5" : "border-danger/30 bg-danger/5";
  const chip = tone === "a" ? "text-primary" : "text-danger";
  return (
    <div className={`rounded border p-4 ${accent}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{tone === "a" ? "Player A" : "Player B"}</div>
        <div className={`font-mono text-[10px] uppercase tracking-widest ${chip}`}>{era.team} {era.year}</div>
      </div>
      <div className="text-sm font-semibold">{era.name}</div>
      <div className="mt-0.5 font-mono text-[11px] text-muted">{era.role}</div>
      <p className="mt-2 text-xs leading-relaxed text-foreground/85">{era.style}</p>
      <div className="mt-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Career highlights</div>
        <ul className="ml-3 list-disc space-y-0.5 text-xs text-foreground/85">
          {era.achievements.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}


function MatchupHeader({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-foreground/80">{summary}</p>
    </div>
  );
}

function EraCard({ era, tone }: { era: HistoricalMatchup["a"]; tone: "a" | "b" }) {
  const accent = tone === "a" ? "border-primary/40 bg-primary/5" : "border-danger/30 bg-danger/5";
  const chip = tone === "a" ? "text-primary" : "text-danger";
  return (
    <div className={`rounded border p-4 ${accent}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {tone === "a" ? "Era A" : "Era B"}
        </div>
        <div className={`font-mono text-[10px] uppercase tracking-widest ${chip}`}>
          {era.team} {era.year}
        </div>
      </div>
      <div className="text-sm font-semibold">{era.manager}</div>
      <div className="mt-0.5 font-mono text-[11px] text-muted">
        Formation {era.formation}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-foreground/85">{era.style}</p>
      <div className="mt-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Achievements</div>
        <ul className="ml-3 list-disc space-y-0.5 text-xs text-foreground/85">
          {era.achievements.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Key players</div>
        <div className="flex flex-wrap gap-1">
          {era.keyPlayers.map((p) => (
            <span key={p} className="rounded border border-border bg-background/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground/85">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCompare({ aLabel, bLabel, stats }: { aLabel: string; bLabel: string; stats: EraStat[] }) {
  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span className="text-primary">{aLabel}</span>
        <span className="text-muted">Metric</span>
        <span className="text-danger">{bLabel}</span>
      </div>
      <ul className="divide-y divide-border">
        {stats.map((s) => (
          <StatRow key={s.label} s={s} />
        ))}
      </ul>
    </div>
  );
}

function StatRow({ s }: { s: EraStat }) {
  const total = Math.max(0.0001, Math.abs(s.a) + Math.abs(s.b));
  const aPct = (Math.abs(s.a) / total) * 100;
  const bPct = 100 - aPct;
  const winnerA = s.higherIsBetter === undefined ? false : s.higherIsBetter ? s.a > s.b : s.a < s.b;
  const winnerB = s.higherIsBetter === undefined ? false : s.higherIsBetter ? s.b > s.a : s.b < s.a;
  const fmt = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(2));
  return (
    <li className="py-2">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className={`font-mono ${winnerA ? "text-primary font-bold" : "text-foreground/80"}`}>
          {fmt(s.a)}{s.unit ?? ""}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {s.label}
        </span>
        <span className={`font-mono ${winnerB ? "text-danger font-bold" : "text-foreground/80"}`}>
          {fmt(s.b)}{s.unit ?? ""}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded bg-background/40">
        <div className="bg-primary/60" style={{ width: `${aPct}%` }} />
        <div className="bg-danger/50" style={{ width: `${bPct}%` }} />
      </div>
      {s.hint && <div className="mt-1 font-mono text-[10px] text-muted">{s.hint}</div>}
    </li>
  );
}
