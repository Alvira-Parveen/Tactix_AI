import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { fetchPlayerIntel, validatePlayerName, type PlayerIntel } from "@/lib/player-intel";
import { ConfidenceBadge, InsufficientDataCallout } from "@/components/tactix/PlayerConfidence";
import { ComparisonBars, ComparisonSeasonLines } from "@/components/tactix/PlayerCharts";

// ─── Player Compare page ─────────────────────────────────────────────────
// Enter 2–4 player names, get a side-by-side card + comparison charts
// (career totals + season goals+assists timeline). Names are encoded in
// the URL search param so the comparison is shareable.

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

type LoadedPlayer = { name: string; intel: PlayerIntel };

export const Route = createFileRoute("/players/compare")({
  head: () => ({
    meta: [
      { title: "TACTIX AI — Compare players" },
      { name: "description", content: "Side-by-side football player comparison: career stats, position, style, and season-by-season performance." },
      { property: "og:title", content: "TACTIX AI — Compare players" },
      { property: "og:description", content: "Side-by-side comparison of stats, roles, and performance trends." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    names: typeof search.names === "string" ? search.names.slice(0, 400) : "",
  }),
  component: ComparePage,
});

function parseNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_PLAYERS);
}

function ComparePage() {
  const { names } = Route.useSearch();
  const navigate = useNavigate({ from: "/players/compare" });

  const initialNames = useMemo(() => parseNames(names), [names]);
  // Draft editing state — an array of up to MAX_PLAYERS name inputs.
  const [drafts, setDrafts] = useState<string[]>(() => {
    const seed = initialNames.length ? initialNames : [""];
    while (seed.length < MIN_PLAYERS) seed.push("");
    return seed;
  });
  const [players, setPlayers] = useState<LoadedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Auto-run when navigated to with ?names=... in the URL.
  useEffect(() => {
    if (initialNames.length >= MIN_PLAYERS) {
      void runCompare(initialNames);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  async function runCompare(list: string[]) {
    setGlobalError(null);
    setErrors({});
    const newErrors: Record<number, string> = {};
    const validated: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = validatePlayerName(list[i]);
      if (!v.ok) newErrors[i] = v.error;
      else validated.push(v.value);
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    // Dedupe (case-insensitive)
    const seen = new Set<string>();
    const unique = validated.filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (unique.length < MIN_PLAYERS) {
      setGlobalError(`Enter at least ${MIN_PLAYERS} distinct players`);
      return;
    }

    setLoading(true);
    setPlayers([]);
    try {
      const settled = await Promise.allSettled(unique.map((n) => fetchPlayerIntel(n)));
      const loaded: LoadedPlayer[] = [];
      const failMsgs: string[] = [];
      settled.forEach((res, i) => {
        if (res.status === "fulfilled") {
          loaded.push({ name: unique[i], intel: res.value });
        } else {
          failMsgs.push(`${unique[i]}: ${res.reason instanceof Error ? res.reason.message : "failed"}`);
        }
      });
      setPlayers(loaded);
      if (failMsgs.length) setGlobalError(failMsgs.join(" · "));
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = drafts.map((d) => d.trim()).filter(Boolean);
    if (trimmed.length < MIN_PLAYERS) {
      setGlobalError(`Enter at least ${MIN_PLAYERS} players`);
      return;
    }
    // Push into URL so it's shareable — the effect will trigger the fetch.
    navigate({ search: { names: trimmed.join(",") } });
  };

  const addSlot = () => {
    if (drafts.length >= MAX_PLAYERS) return;
    setDrafts([...drafts, ""]);
  };
  const removeSlot = (i: number) => {
    if (drafts.length <= MIN_PLAYERS) return;
    setDrafts(drafts.filter((_, idx) => idx !== i));
  };
  const updateSlot = (i: number, val: string) => {
    const copy = drafts.slice();
    copy[i] = val.slice(0, 80);
    setDrafts(copy);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CompareNav />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="mb-4">
          <Link to="/players" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to search
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Compare players</h1>
          <p className="mt-1 text-sm text-muted">
            Enter {MIN_PLAYERS}–{MAX_PLAYERS} players and get a side-by-side card: career totals, role, and season-by-season trends.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded border border-border bg-surface/30 p-4">
          <div className="grid gap-2">
            {drafts.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={d}
                  onChange={(e) => updateSlot(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                  maxLength={80}
                  className={`flex-1 rounded border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none ${
                    errors[i] ? "border-danger/50" : "border-border"
                  }`}
                />
                {drafts.length > MIN_PLAYERS && (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    className="rounded border border-border p-2 text-muted hover:text-danger"
                    aria-label={`Remove player ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {Object.entries(errors).map(([i, msg]) => (
              <div key={i} className="font-mono text-[10px] text-danger">Player {Number(i) + 1}: {msg}</div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addSlot}
              disabled={drafts.length >= MAX_PLAYERS}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-3.5" /> Add player
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {loading ? "Comparing" : "Compare"}
            </button>
          </div>
        </form>

        {globalError && (
          <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] text-danger">
            {globalError}
          </div>
        )}

        {loading && (
          <div className="rounded border border-border bg-surface/30 p-8 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" />
            Fetching intel for {drafts.filter(Boolean).length} players…
          </div>
        )}

        {!loading && players.length >= MIN_PLAYERS && <ComparisonBody players={players} />}
      </main>
    </div>
  );
}

function ComparisonBody({ players }: { players: LoadedPlayer[] }) {
  const insufficient = players.filter((p) => p.intel.dataConfidence === "insufficient");

  return (
    <div className="grid gap-4">
      {/* Side-by-side cards */}
      <div className={`grid gap-3 ${players.length === 2 ? "md:grid-cols-2" : players.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
        {players.map((p) => (
          <div key={p.name} className="rounded border border-border bg-surface/30 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <ConfidenceBadge intel={p.intel} />
              <Link
                to="/players/$name"
                params={{ name: encodeURIComponent(p.intel.fullName ?? p.name) }}
                className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-primary"
              >
                Full profile →
              </Link>
            </div>
            <h2 className="text-lg font-bold leading-tight">{p.intel.fullName ?? p.name}</h2>
            <div className="mb-3 font-mono text-[10px] text-muted">
              {[p.intel.position, p.intel.currentClub, p.intel.nationality].filter(Boolean).join(" · ")}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Apps" value={p.intel.careerStats?.apps} />
              <MiniStat label="Goals" value={p.intel.careerStats?.goals} />
              <MiniStat label="Assists" value={p.intel.careerStats?.assists} />
            </div>
            {p.intel.international?.team && (
              <div className="mt-3 border-t border-border/60 pt-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">International</div>
                <div className="text-sm">
                  {p.intel.international.team}
                  {typeof p.intel.international.caps === "number" && (
                    <span className="ml-2 font-mono text-[11px] text-muted">
                      {p.intel.international.caps} caps · {p.intel.international.goals ?? 0} g
                    </span>
                  )}
                </div>
              </div>
            )}
            {p.intel.recentForm && (
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-foreground/85">{p.intel.recentForm}</p>
            )}
          </div>
        ))}
      </div>

      {insufficient.length > 0 && (
        <div className="rounded border border-danger/30 bg-danger/5 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-danger">Insufficient historical data</div>
          <p className="text-xs text-foreground/85">
            Charts below exclude: {insufficient.map((p) => p.intel.fullName ?? p.name).join(", ")}. The model couldn't confidently produce season/match stats for {insufficient.length === 1 ? "this player" : "these players"}.
          </p>
        </div>
      )}

      {/* Comparison charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <ComparisonBars players={players} metric="goals" />
        <ComparisonBars players={players} metric="assists" />
        <ComparisonBars players={players} metric="apps" />
      </div>
      <ComparisonSeasonLines players={players.filter((p) => (p.intel.seasonStats?.length ?? 0) > 0)} />
    </div>
  );
}

function CompareNav() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-sm bg-primary">
          <div className="size-2 rotate-45 bg-background" />
        </div>
        <span className="text-lg font-bold uppercase tracking-tighter">Tactix AI</span>
      </Link>
      <div className="flex gap-6 text-xs font-medium uppercase tracking-widest text-muted">
        <Link to="/players" className="hover:text-foreground">Players</Link>
        <span className="text-foreground border-b border-primary pb-1">Compare</span>
      </div>
    </nav>
  );
}

function MiniStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded border border-border bg-background/40 p-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className="text-base font-bold text-foreground">{typeof value === "number" ? value : "—"}</div>
    </div>
  );
}
