import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, User, GitCompare } from "lucide-react";
import { fetchPlayerIntel, type PlayerIntel } from "@/lib/player-intel";
import {
  ConfidenceBadge, InsufficientDataCallout, LowConfidenceNote,
} from "@/components/tactix/PlayerConfidence";
import {
  RecentFormChart, SeasonChart, ClubVsCountryChart,
} from "@/components/tactix/PlayerCharts";

// ─── Player profile page ─────────────────────────────────────────────────
// Deep-dive on one player: bio, career timeline, honours, season stats,
// recent match log (expandable), and interactive charts. Fetches via
// /api/player-intel on mount; the API layer already caches for 1 hour.

export const Route = createFileRoute("/players/$name")({
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.name)} — TACTIX AI player profile` },
      { name: "description", content: `AI-generated intel, career timeline, honours, and form charts for ${decodeURIComponent(params.name)}.` },
      { property: "og:title", content: `${decodeURIComponent(params.name)} — TACTIX AI` },
      { property: "og:description", content: `Career timeline, honours, and form charts.` },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    hint: typeof search.hint === "string" ? search.hint.slice(0, 120) : "",
  }),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { name } = Route.useParams();
  const { hint } = Route.useSearch();
  const decodedName = decodeURIComponent(name);

  const [intel, setIntel] = useState<PlayerIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIntel(null);
    fetchPlayerIntel(decodedName, hint)
      .then((data) => { if (!cancelled) setIntel(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Lookup failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [decodedName, hint]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileNav />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/players" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to search
          </Link>
          {intel && !intel.unknown && (
            <Link
              to="/players/compare"
              search={{ names: intel.fullName ?? decodedName }}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-surface/30 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-foreground"
            >
              <GitCompare className="size-3.5" /> Compare
            </Link>
          )}
        </div>

        {loading && (
          <div className="rounded border border-border bg-surface/30 p-8 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" />
            Compiling intel on <span className="text-foreground">{decodedName}</span>…
          </div>
        )}

        {error && !loading && (
          <div className="rounded border border-danger/40 bg-danger/10 p-4 font-mono text-[11px] text-danger">
            {error}
          </div>
        )}

        {intel?.unknown && (
          <div className="rounded border border-border bg-surface/30 p-6 text-center text-sm text-muted">
            <User className="mx-auto mb-2 size-6" />
            No confident match for <span className="text-foreground">"{decodedName}"</span>.
          </div>
        )}

        {intel && !intel.unknown && <ProfileBody intel={intel} />}
      </main>
    </div>
  );
}

function ProfileBody({ intel }: { intel: PlayerIntel }) {
  return (
    <div className="grid gap-4">
      {/* Header */}
      <div className="rounded border border-border bg-surface/30 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ConfidenceBadge intel={intel} />
              {intel.nationality && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{intel.nationality}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{intel.fullName}</h1>
            {intel.nickname && <p className="font-mono text-[11px] text-muted">"{intel.nickname}"</p>}
          </div>
          {intel.currentClub && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Current club</div>
              <div className="text-lg font-semibold text-primary">
                {intel.currentClub}{intel.shirtNumber && <span className="ml-2 text-muted">#{intel.shirtNumber}</span>}
              </div>
              {intel.position && <div className="font-mono text-[10px] text-muted">{intel.position}</div>}
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCell label="Foot" value={intel.preferredFoot} />
          <StatCell label="Height" value={intel.heightCm ? `${intel.heightCm} cm` : undefined} />
          <StatCell label="Born" value={intel.dateOfBirth} />
          <StatCell label="Birthplace" value={intel.countryOfBirth} />
          <StatCell label="Market value" value={intel.marketValue} />
          <StatCell label="Career apps" value={intel.careerStats?.apps} />
          <StatCell label="Career goals" value={intel.careerStats?.goals} />
          <StatCell label="Career assists" value={intel.careerStats?.assists} />
        </div>
      </div>

      <InsufficientDataCallout intel={intel} />
      <LowConfidenceNote intel={intel} />

      {/* Charts row */}
      {(intel.recentMatches?.length || intel.seasonStats?.length || intel.clubVsCountry) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {intel.recentMatches?.length ? <RecentFormChart matches={intel.recentMatches} /> : null}
          {intel.seasonStats?.length ? <SeasonChart seasons={intel.seasonStats} /> : null}
          {intel.clubVsCountry && <ClubVsCountryChart intel={intel} />}
          {intel.playingStyle && (
            <div className="rounded border border-border bg-surface/30 p-4">
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Playing style</h3>
              <p className="text-sm leading-relaxed text-foreground/90">{intel.playingStyle}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {intel.strengths?.length ? (
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">Strengths</div>
                    <ul className="space-y-1 text-sm">
                      {intel.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-primary">+</span>{s}</li>)}
                    </ul>
                  </div>
                ) : null}
                {intel.weaknesses?.length ? (
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-danger">Weaknesses</div>
                    <ul className="space-y-1 text-sm">
                      {intel.weaknesses.map((s, i) => <li key={i} className="flex gap-2"><span className="text-danger">−</span>{s}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Career timeline */}
      {intel.career?.length ? (
        <div className="rounded border border-border bg-surface/30 p-4">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">Career timeline</h3>
          <ol className="relative border-l border-border pl-4">
            {intel.career.map((c, i) => (
              <li key={i} className="mb-3 last:mb-0">
                <span className="absolute -left-[5px] mt-1 size-2 rounded-full bg-primary" />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.club}</div>
                    {c.note && <div className="font-mono text-[10px] text-muted">{c.note}</div>}
                  </div>
                  <div className="flex items-baseline gap-3 font-mono text-[11px] text-muted">
                    <span>{c.years}</span>
                    {typeof c.apps === "number" && <span>{c.apps} apps</span>}
                    {typeof c.goals === "number" && <span className="text-primary">{c.goals} g</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* International + honours */}
      <div className="grid gap-4 md:grid-cols-2">
        {intel.international?.team && (
          <div className="rounded border border-border bg-surface/30 p-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">International</h3>
            <div className="text-base font-semibold">{intel.international.team}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BigStat label="Caps" value={intel.international.caps} />
              <BigStat label="Goals" value={intel.international.goals} />
            </div>
            {intel.international.debut && (
              <div className="mt-2 font-mono text-[10px] text-muted">Debut: {intel.international.debut}</div>
            )}
          </div>
        )}
        {intel.honours?.length ? (
          <div className="rounded border border-border bg-surface/30 p-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Honours</h3>
            <ul className="grid gap-1 sm:grid-cols-2">
              {intel.honours.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm"><span className="text-primary">★</span>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Expandable match log */}
      {intel.recentMatches?.length ? <MatchLogSection matches={intel.recentMatches} /> : null}

      {intel.recentForm && (
        <div className="rounded border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">Recent form summary</div>
          <p className="text-sm leading-relaxed text-foreground/90">{intel.recentForm}</p>
        </div>
      )}

      {intel.disclaimer && (
        <p className="font-mono text-[10px] text-muted">{intel.disclaimer}</p>
      )}
    </div>
  );
}

function MatchLogSection({ matches }: { matches: NonNullable<PlayerIntel["recentMatches"]> }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="rounded border border-border bg-surface/30 p-4">
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">Match-by-match</h3>
      <ul className="divide-y divide-border/60">
        {matches.map((m, i) => {
          const open = openIdx === i;
          const label = `${m.home === false ? "away vs" : "vs"} ${m.opponent ?? "—"}`;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-background/30"
              >
                <div className="flex items-center gap-2">
                  {open ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{m.date ?? "—"}</span>
                  <span className="text-sm text-foreground">{label}</span>
                  {m.competition && <span className="font-mono text-[10px] text-muted">· {m.competition}</span>}
                </div>
                <div className="flex items-baseline gap-3 font-mono text-[11px]">
                  {m.result && <span className="text-foreground">{m.result}</span>}
                  {typeof m.goals === "number" && m.goals > 0 && <span className="text-primary">{m.goals}G</span>}
                  {typeof m.assists === "number" && m.assists > 0 && <span className="text-[#a78bfa]">{m.assists}A</span>}
                  {typeof m.rating === "number" && (
                    <span className={m.rating >= 7.5 ? "text-emerald-400" : m.rating >= 6.5 ? "text-primary" : "text-danger"}>
                      {m.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </button>
              {open && (
                <div className="grid gap-2 rounded bg-background/40 p-3 text-xs sm:grid-cols-4">
                  <KV k="Minutes" v={m.minutes} />
                  <KV k="Goals" v={m.goals} />
                  <KV k="Assists" v={m.assists} />
                  <KV k="Rating" v={typeof m.rating === "number" ? m.rating.toFixed(1) : undefined} />
                  {m.note && (
                    <div className="sm:col-span-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Note</div>
                      <div className="text-sm text-foreground/90">{m.note}</div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProfileNav() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-sm bg-primary">
          <div className="size-2 rotate-45 bg-background" />
        </div>
        <span className="text-lg font-bold uppercase tracking-tighter">Tactix AI</span>
      </Link>
      <div className="flex gap-6 text-xs font-medium uppercase tracking-widest text-muted">
        <Link to="/players" className="text-foreground border-b border-primary pb-1">Players</Link>
        <Link to="/players/compare" search={{ names: "" }} className="hover:text-foreground">Compare</Link>
      </div>
    </nav>
  );
}

function StatCell({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
function BigStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded border border-border bg-background/40 p-2 text-center">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className="text-lg font-bold text-foreground">{typeof value === "number" ? value : "—"}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v?: string | number }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{k}</div>
      <div className="text-sm font-semibold text-foreground">{v ?? "—"}</div>
    </div>
  );
}
