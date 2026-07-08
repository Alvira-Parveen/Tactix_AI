import { useEffect, useState } from "react";
import { StageBadge } from "@/components/tactix/StageBadge";
import { getFlagEmoji } from "@/lib/match-data";

type Fixture = {
  id: number;
  status: string;
  minute: number | null;
  kickoff: string;
  league: string;
  round: string;
  homeName: string;
  homeCode: string;
  homeScore: number | null;
  homePens?: number | null;
  awayName: string;
  awayCode: string;
  awayScore: number | null;
  awayPens?: number | null;
  venue: string;
};


type ApiPayload = {
  fixtures: Fixture[];
  source: string;
  error?: string;
};

function statusChip(f: Fixture) {
  const s = f.status;
  if (["1H", "2H", "ET", "P", "LIVE"].includes(s)) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-danger">
        <span className="size-1.5 animate-[pulse-glow_2s_infinite] rounded-full bg-danger" />
        {f.minute ? `Live · ${f.minute}'` : "Live"}
      </span>
    );
  }
  if (s === "HT") {
    return (
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
        Half time
      </span>
    );
  }
  if (s === "PEN") {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
        FT (P)
      </span>
    );
  }
  if (["FT", "AET"].includes(s)) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
        Full time
      </span>
    );
  }
  const time = new Date(f.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
      {time}
    </span>
  );
}

export function LiveFootballFeed() {
  const [state, setState] = useState<{
    loading: boolean;
    payload: ApiPayload | null;
    error: string | null;
  }>({ loading: true, payload: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/live-fixtures", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = (await res.json()) as ApiPayload;
        if (!cancelled) setState({ loading: false, payload: data, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            payload: null,
            error: err instanceof Error ? err.message : "Failed to load",
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { loading, payload, error } = state;
  const fixtures = payload?.fixtures ?? [];
  const hasError = !!error || !!payload?.error;

  const source = payload?.source ?? "";
  const isCurated = source === "curated-wc2026-schedule";
  const sourceLabel = isCurated
    ? "Official FIFA schedule"
    : source === "cache"
      ? "Real Data · api-football (cached)"
      : "Real Data · api-football";
  const sourceStyle = isCurated
    ? "border-warning/30 bg-warning/10 text-warning"
    : "border-primary/30 bg-primary/10 text-primary";

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
        <span className="size-2 rounded-full bg-primary" />
        <h2 className="text-xs font-bold uppercase tracking-widest">
          FIFA World Cup 2026 · Live feed
        </h2>
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${sourceStyle}`}>
          {sourceLabel}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted">
          {loading ? "Fetching…" : `${fixtures.length} fixtures`}
        </span>
      </div>

      {isCurated && !loading && fixtures.length > 0 && (
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">
          Live feed unavailable — showing upcoming fixtures from the official FIFA WC 2026 schedule.
        </p>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-sm border border-border bg-card/40" />
          ))}
        </div>
      )}

      {!loading && hasError && (
        <div className="rounded-sm border border-danger/30 bg-danger/5 p-4 text-sm text-muted">
          Live fixture feed unavailable ({error ?? payload?.error}). Showing curated fixtures below.
        </div>
      )}

      {!loading && !hasError && fixtures.length === 0 && (
        <div className="rounded-sm border border-border bg-card/40 p-4 text-sm text-muted">
          No fixtures reported by the live feed right now.
        </div>
      )}

      {!loading && fixtures.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fixtures.map((f) => (
            <article
              key={f.id}
              tabIndex={0}
              className="group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-sm border border-border bg-card p-5 transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] focus-visible:-translate-y-1 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-primary),0_20px_40px_-24px_rgba(0,0,0,0.5)] active:translate-y-0"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[300%] group-hover:opacity-100"
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted transition-colors duration-300 group-hover:text-foreground">
                    {f.league}
                  </span>
                  <StageBadge round={f.round} />
                </div>
                {statusChip(f)}
              </div>

              <div className="relative flex items-center justify-between">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 transition-[transform,border-color,box-shadow] duration-300 group-hover:scale-110 group-hover:border-primary/40 group-hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]">
                    {f.homeLogo && f.homeLogo.startsWith("http") ? (
                      <img src={f.homeLogo} alt={f.homeName} className="size-6 object-contain" />
                    ) : getFlagEmoji(f.homeCode || f.homeName) ? (
                      <span className="text-xl" style={{ lineHeight: 1 }}>{getFlagEmoji(f.homeCode || f.homeName)}</span>
                    ) : (
                      <span className="text-sm font-bold">{f.homeCode}</span>
                    )}
                  </div>
                  <span className="max-w-[80px] truncate text-[11px] font-medium">
                    {f.homeName}
                  </span>
                </div>
                <div className="text-center">
                  {f.homeScore !== null && f.awayScore !== null ? (
                    <div className="font-mono text-3xl font-bold tracking-tighter flex items-baseline justify-center">
                      <span>{f.homeScore}</span>
                      {f.homePens !== undefined && f.homePens !== null && (
                        <span className="text-[14px] font-normal text-muted" style={{ marginLeft: 2 }}>({f.homePens})</span>
                      )}
                      <span className="text-muted" style={{ margin: "0 6px" }}>-</span>
                      <span>{f.awayScore}</span>
                      {f.awayPens !== undefined && f.awayPens !== null && (
                        <span className="text-[14px] font-normal text-muted" style={{ marginLeft: 2 }}>({f.awayPens})</span>
                      )}
                    </div>
                  ) : (
                    <div className="font-mono text-2xl font-bold tracking-tighter text-muted transition-colors duration-300 group-hover:text-foreground">
                      vs
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 transition-[transform,border-color,box-shadow] duration-300 group-hover:scale-110 group-hover:border-primary/40 group-hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]">
                    {f.awayLogo && f.awayLogo.startsWith("http") ? (
                      <img src={f.awayLogo} alt={f.awayName} className="size-6 object-contain" />
                    ) : getFlagEmoji(f.awayCode || f.awayName) ? (
                      <span className="text-xl" style={{ lineHeight: 1 }}>{getFlagEmoji(f.awayCode || f.awayName)}</span>
                    ) : (
                      <span className="text-sm font-bold">{f.awayCode}</span>
                    )}
                  </div>
                  <span className="max-w-[80px] truncate text-[11px] font-medium text-muted transition-colors duration-300 group-hover:text-foreground">
                    {f.awayName}
                  </span>
                </div>
              </div>

              <div className="relative truncate border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted transition-colors duration-300 group-hover:border-primary/30 group-hover:text-foreground">
                {f.round || f.venue || "—"}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
