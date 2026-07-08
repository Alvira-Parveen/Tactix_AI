import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MATCHES, getMatchDataset, getFlagEmoji, type MatchState } from "@/lib/match-data";
import { getFixtures } from "@/lib/fixtures.functions";
import { COMPETITIONS, isCompetitionCode, type CompetitionCode } from "@/lib/fixtures.server";
import { LiveFootballFeed } from "@/components/tactix/LiveFootballFeed";
import { ShareButton } from "@/components/tactix/ShareButton";
import { buildMatchPreviewText } from "@/lib/live-insights";
import { StageBadge } from "@/components/tactix/StageBadge";
import { AgentConsole } from "@/components/tactix/AgentConsole";
import { FixturesPageSkeleton } from "@/components/tactix/Skeleton";

const fixturesQueryOptions = (competition: CompetitionCode) =>
  queryOptions({
    queryKey: ["fixtures", competition],
    queryFn: () => getFixtures({ data: { competition } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { comp: CompetitionCode } => ({
    comp: isCompetitionCode(search.comp) ? search.comp : "WC",
  }),
  loaderDeps: ({ search }) => ({ comp: search.comp }),
  head: () => ({
    meta: [
      { title: "TACTIX AI — Match Hub" },
      { name: "description", content: "Live AI-powered tactical intelligence across every top football competition. Switch competitions and open the analyst dashboard on any match." },
      { property: "og:title", content: "TACTIX AI — Match Hub" },
      { property: "og:description", content: "Live AI-powered tactical intelligence for World Cup, Champions League, Premier League and more." },
    ],
  }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(fixturesQueryOptions(deps.comp)),
  pendingComponent: FixturesPageSkeleton,
  pendingMs: 150,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-danger">Failed to load fixtures: {error.message}</div>
  ),
  component: MatchHub,
});



function statusBadge(match: MatchState) {
  if (match.status === "live") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-danger">
        <span className="size-1.5 animate-[pulse-glow_2s_infinite] rounded-full bg-danger" />
        Live · {match.minute}'
      </span>
    );
  }
  if (match.status === "upcoming") {
    return (
      <span
        className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ borderColor: "rgba(28,28,28,0.4)", color: "#1c1c1c" }}
      >
        {match.kickoff}
      </span>
    );
  }
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={{ borderColor: "#eceae4", color: "#5f5f5d" }}
    >
      Full time
    </span>
  );
}

function MatchHub() {
  const { comp } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: fixtures } = useSuspenseQuery(fixturesQueryOptions(comp));
  const allMatches = fixtures.matches;

  const [liveScores, setLiveScores] = useState<Record<string, { homeScore: number | null; awayScore: number | null; homePens?: number | null; awayPens?: number | null; status: string }>>({});

  useEffect(() => {
    fetch("/api/live-fixtures")
      .then((res) => res.json())
      .then((data) => {
        if (data?.fixtures) {
          const scores: typeof liveScores = {};
          data.fixtures.forEach((f: any) => {
            const nameKey = `${f.homeName.toLowerCase()}-${f.awayName.toLowerCase()}`;
            const codeKey = `${f.homeCode.toLowerCase()}-${f.awayCode.toLowerCase()}`;
            const scoreObj = {
              homeScore: f.homeScore,
              awayScore: f.awayScore,
              homePens: f.homePens,
              awayPens: f.awayPens,
              status: f.status,
            };
            scores[nameKey] = scoreObj;
            scores[codeKey] = scoreObj;
          });
          setLiveScores(scores);
        }
      })
      .catch(console.error);
  }, []);

  const enrichedMatches = allMatches.map((m) => {
    const nameKey = `${m.home.name.toLowerCase()}-${m.away.name.toLowerCase()}`;
    const codeKey = `${m.home.code.toLowerCase()}-${m.away.code.toLowerCase()}`;
    const liveMatch = liveScores[nameKey] || liveScores[codeKey];

    if (liveMatch && (m.status === "finished" || liveMatch.status === "FT" || liveMatch.status === "finished" || liveMatch.status === "PEN")) {
      return {
        ...m,
        status: "finished",
        half: liveMatch.status === "PEN" ? "FT (P)" : "Full time",
        minute: 90,
        homeScore: liveMatch.homeScore !== null ? liveMatch.homeScore : m.homeScore,
        awayScore: liveMatch.awayScore !== null ? liveMatch.awayScore : m.awayScore,
        homePens: liveMatch.homePens !== null && liveMatch.homePens !== undefined ? liveMatch.homePens : m.homePens,
        awayPens: liveMatch.awayPens !== null && liveMatch.awayPens !== undefined ? liveMatch.awayPens : m.awayPens,
      };
    }
    return m;
  });

  const live = enrichedMatches.filter((m) => m.status === "live");
  const upcomingAll = enrichedMatches.filter((m) => m.status === "upcoming");
  const finishedAll = enrichedMatches.filter((m) => m.status === "finished");
  const upcoming = upcomingAll.slice(0, 12);
  const finished = finishedAll.slice(-9).reverse();
  const linkableLive = live.find((m) => getMatchDataset(m.id));
  const featuredMatchId = linkableLive?.id ?? MATCHES[0].id;
  const [menuOpen, setMenuOpen] = useState(false);




  return (
    <div className="theme-cream min-h-screen pb-24">
      {/* Warm gradient wash — barely visible atmospheric depth */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, rgba(255,199,169,0.28) 0%, transparent 60%), radial-gradient(50% 60% at 85% 15%, rgba(178,196,240,0.25) 0%, transparent 60%), radial-gradient(45% 50% at 55% 35%, rgba(240,207,178,0.22) 0%, transparent 65%)",
        }}
      />

      {/* Fixed cream nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: "#eceae4", backgroundColor: "rgba(247,244,237,0.85)", backdropFilter: "blur(10px)" }}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: "#1c1c1c" }}>
              <div className="size-2 rotate-45" style={{ backgroundColor: "#fcfbf8" }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "#1c1c1c" }}>
              Tactix AI
            </span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <Link to="/" className="text-[14px]" style={{ color: "#1c1c1c" }}>Match Hub</Link>
            <Link to="/match/$matchId" params={{ matchId: featuredMatchId }} className="text-[14px]" style={{ color: "#1c1c1c" }}>Dashboard</Link>
            <Link to="/coach/$matchId" params={{ matchId: featuredMatchId }} className="text-[14px]" style={{ color: "#1c1c1c" }}>AI Coach</Link>
            <Link to="/chat" className="text-[14px]" style={{ color: "#1c1c1c" }}>AI Chat</Link>
            <Link to="/players" className="text-[14px]" style={{ color: "#1c1c1c" }}>Players</Link>
            <Link to="/history" className="text-[14px]" style={{ color: "#1c1c1c" }}>History</Link>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton title="TACTIX AI — Match Hub" text="Live AI-powered tactical intelligence for World Cup 2026." />
            <Link
              to="/match/$matchId"
              params={{ matchId: featuredMatchId }}
              className="btn-inset text-[14px] hidden sm:inline-flex"
            >
              {linkableLive ? "Open live dashboard" : "Open dashboard"}
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-md border md:hidden"
              style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}
            >
              <div className="flex flex-col gap-[3px]">
                <span className="block h-[2px] w-4 rounded" style={{ backgroundColor: "#1c1c1c" }} />
                <span className="block h-[2px] w-4 rounded" style={{ backgroundColor: "#1c1c1c" }} />
                <span className="block h-[2px] w-4 rounded" style={{ backgroundColor: "#1c1c1c" }} />
              </div>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t md:hidden" style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}>
            <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-1 px-4 py-3">
              {[
                { label: "Match Hub", to: "/" as const },
                { label: "History", to: "/history" as const },
                { label: "AI Chat", to: "/chat" as const },
                { label: "Players", to: "/players" as const },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-[14px]"
                  style={{ color: "#1c1c1c" }}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/match/$matchId"
                params={{ matchId: featuredMatchId }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-[14px]"
                style={{ color: "#1c1c1c" }}
              >
                Live Dashboard
              </Link>
              <Link
                to="/coach/$matchId"
                params={{ matchId: featuredMatchId }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-[14px]"
                style={{ color: "#1c1c1c" }}
              >
                AI Coach
              </Link>
              <Link
                to="/intel/$matchId"
                params={{ matchId: featuredMatchId }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-[14px]"
                style={{ color: "#1c1c1c" }}
              >
                Intelligence
              </Link>
              <Link
                to="/cv/$matchId"
                params={{ matchId: featuredMatchId }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-[14px]"
                style={{ color: "#1c1c1c" }}
              >
                Vision
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Editorial hero */}
      <header className="mx-auto max-w-[1200px] px-6 pt-24 pb-20 text-center md:pt-32">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]"
          style={{ borderColor: "#eceae4", color: "#5f5f5d", backgroundColor: "#f7f4ed" }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: "#1c1c1c" }} />
          FIFA World Cup 2026 · Live coverage
        </span>
        <h1
          className="mx-auto mt-8 max-w-3xl"
          style={{
            fontFamily: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
            fontSize: "clamp(40px, 6vw, 60px)",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-1.5px",
            color: "#1c1c1c",
          }}
        >
          Tactical intelligence for every match, in real time.
        </h1>
        <p
          className="mx-auto mt-6 max-w-xl"
          style={{ fontSize: 18, lineHeight: 1.5, color: "#5f5f5d" }}
        >
          Live xG, momentum, explainable player ratings and an AI analyst grounded in the actual match feed — not fixed copy.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          {linkableLive ? (
            <Link
              to="/match/$matchId"
              params={{ matchId: linkableLive.id }}
              className="btn-inset text-[16px]"
            >
              Watch live analysis
            </Link>
          ) : (
            <a href="#fixtures" className="btn-inset text-[16px]">Browse fixtures</a>
          )}
          <Link to="/history" className="btn-ghost-cream text-[16px]">
            Historical intelligence
          </Link>
        </div>

        {/* Stats bar */}
        <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-8 border-t pt-10" style={{ borderColor: "#eceae4" }}>
          {[
            { n: `${live.length}`, l: "Playing now" },
            { n: `${upcomingAll.length}`, l: "Upcoming" },
            { n: `${finishedAll.length}`, l: "Full time" },
          ].map((s) => (
            <div
              key={s.l}
              tabIndex={0}
              className="group relative cursor-pointer overflow-hidden rounded-lg px-4 py-3 text-center transition-[transform,background-color,box-shadow] duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_16px_32px_-24px_rgba(28,28,28,0.35),0_2px_6px_-2px_rgba(28,28,28,0.12)] focus-visible:-translate-y-1 focus-visible:bg-white focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(43,85,143,0.35)] active:translate-y-0"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[300%] group-hover:opacity-100"
              />
              <div
                className="relative transition-[transform,color] duration-300 group-hover:scale-110 group-hover:text-[#0f0f0f]"
                style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-1.2px", color: "#1c1c1c", lineHeight: 1 }}
              >
                {s.n}
              </div>
              <div
                className="relative mt-2 transition-colors duration-300 group-hover:text-[#1c1c1c]"
                style={{ fontSize: 14, color: "#5f5f5d" }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Live feed section */}
      <section id="feed" className="mx-auto max-w-[1200px] px-6 pb-8">
        <LiveFootballFeed />
      </section>

      {/* Fixtures — editorial groups */}
      <section id="fixtures" className="mx-auto max-w-[1200px] px-6 pb-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div style={{ fontSize: 12, color: "#5f5f5d", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Competition · {fixtures.source === "live" ? "Live from football-data.org" : "Offline fallback"}
            </div>
            <h2 className="mt-1" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", color: "#1c1c1c" }}>
              {fixtures.competitionLabel}
            </h2>
          </div>
          <label className="flex items-center gap-2" style={{ fontSize: 13, color: "#5f5f5d" }}>
            <span>Switch competition</span>
            <select
              value={comp}
              onChange={(e) => {
                const next = e.target.value;
                if (isCompetitionCode(next)) {
                  navigate({ search: { comp: next } });
                }
              }}
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8", color: "#1c1c1c", fontSize: 14 }}
            >
              {COMPETITIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        <MatchGroup title="Live now" matches={live} total={live.length} />
        <MatchGroup title="Upcoming" matches={upcoming} total={upcomingAll.length} />
        <MatchGroup title="Full time" matches={finished} total={finishedAll.length} />


        <AgentConsole matchId={MATCHES[0].id} />
      </section>

      {/* Honest Nuances & Caveats */}
      <section className="mx-auto max-w-[1200px] px-6 pb-16">
        <div className="rounded-2xl border p-8" style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}>
          <h3 className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: "#1c1c1c" }}>Honest Nuances & Caveats</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold mb-1" style={{ color: "#1c1c1c" }}>Workload Offloading (GPU vs Browser)</h4>
              <p className="text-xs leading-relaxed font-sans" style={{ color: "#5f5f5d" }}>
                Running native Python server-side YOLO/ByteTrack requires high-end server GPUs, which would be extremely slow and expensive on standard edge functions. The project handles this elegantly by running YOLO in the browser using WASM (onnxruntime-web) and using Gemini's vision model on sampled video frames for the tactical analysis.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1" style={{ color: "#1c1c1c" }}>Dataset Scope</h4>
              <p className="text-xs leading-relaxed font-sans" style={{ color: "#5f5f5d" }}>
                To deliver a responsive, zero-config showcase experience, the app's real-time events, match scenarios, and statistics are driven by high-fidelity pre-compiled datasets (such as Portugal vs. Spain and Canada vs. Morocco in <code>match-data.ts</code>). This replicates the behavior of a live feed seamlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-[1200px] rounded-2xl border px-8 py-10"
        style={{ borderColor: "#eceae4", backgroundColor: "#f7f4ed" }}
      >
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: "#1c1c1c" }}>
                <div className="size-2 rotate-45" style={{ backgroundColor: "#fcfbf8" }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#1c1c1c", letterSpacing: "-0.01em" }}>
                Tactix AI
              </span>
            </div>
            <p className="mt-3 max-w-md" style={{ fontSize: 14, color: "#5f5f5d" }}>
              Explainable football intelligence — every insight grounded in a real event from the match feed.
            </p>
          </div>
          <div className="flex flex-wrap gap-6" style={{ fontSize: 14, color: "#1c1c1c" }}>
            <Link to="/" className="underline underline-offset-4">Match Hub</Link>
            <Link to="/history" className="underline underline-offset-4">History</Link>
            <a href="#feed" className="underline underline-offset-4">Live Feed</a>
          </div>
        </div>
        <div
          className="mt-8 flex flex-col justify-between gap-2 border-t pt-6 md:flex-row"
          style={{ borderColor: "#eceae4", fontSize: 12, color: "#5f5f5d" }}
        >
          <span>© 2026 Tactix AI. All rights reserved.</span>
          <span>Fixtures via api-football · Fallback: official FIFA schedule.</span>
        </div>
      </footer>
    </div>
  );
}

function MatchGroup({ title, matches, total }: { title: string; matches: MatchState[]; total?: number }) {
  if (matches.length === 0) return null;
  return (
    <section className="mb-14">
      <div className="mb-6 flex items-baseline justify-between">
        <h2
          style={{
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: "-0.9px",
            color: "#1c1c1c",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        <span style={{ fontSize: 14, color: "#5f5f5d" }}>
          {total && total > matches.length ? `Showing ${matches.length} of ${total}` : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match }: { match: MatchState }) {
  // A card is linkable if we have a curated dataset OR a real football-data.org fixture ID.
  const hasDataset = Boolean(getMatchDataset(match.id));
  const isFdFixture = match.id.startsWith("fd-");
  const linkable = hasDataset || isFdFixture;

  const cardClasses =
    "group relative overflow-hidden flex flex-col gap-4 rounded-xl border p-5 transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(28,28,28,0.35),0_2px_6px_-2px_rgba(28,28,28,0.15)] hover:border-[#d9d5c9] hover:bg-[#faf7f0] active:scale-[0.99] active:shadow-none cursor-pointer";
  const staticClasses = "flex flex-col gap-4 rounded-xl border p-5";
  const cardStyle = { borderColor: "#eceae4", backgroundColor: "#f7f4ed" } as const;

  const inner = (
    <>
      {linkable && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/2 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[260%] group-hover:opacity-100"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate" style={{ fontSize: 12, color: "#5f5f5d", letterSpacing: "0.02em" }}>
            {match.competition}
          </span>
          <StageBadge round={match.stage} />
        </div>
        {statusBadge(match)}
      </div>

      <div className="flex items-center justify-between">
        <TeamBlock code={match.home.code} name={match.home.name} />
        <div className="text-center">
          {match.status === "upcoming" ? (
            <div style={{ fontSize: 24, fontWeight: 600, color: "#5f5f5d", letterSpacing: "-0.9px" }}>vs</div>
          ) : (
            <div style={{ fontSize: 32, fontWeight: 600, color: "#1c1c1c", letterSpacing: "-1.2px", lineHeight: 1, display: "flex", alignItems: "baseline", justifyContent: "center" }}>
              <span>{match.homeScore}</span>
              {match.homePens !== undefined && (
                <span style={{ fontSize: 16, fontWeight: 400, color: "#5f5f5d", marginLeft: 2 }}>({match.homePens})</span>
              )}
              <span style={{ color: "#5f5f5d", margin: "0 6px" }}>–</span>
              <span>{match.awayScore}</span>
              {match.awayPens !== undefined && (
                <span style={{ fontSize: 16, fontWeight: 400, color: "#5f5f5d", marginLeft: 2 }}>({match.awayPens})</span>
              )}
            </div>
          )}
          <div className="mt-1" style={{ fontSize: 11, color: "#5f5f5d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {match.status === "upcoming" ? match.kickoff : match.half}
          </div>
        </div>
        <TeamBlock code={match.away.code} name={match.away.name} muted />
      </div>

      <div className="rounded-lg border border-[#eceae4] bg-[#fcfbf8]/80 px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5f5f5d]">
          Tactical preview
        </div>
        <div className="text-[12px] leading-5 text-[#1c1c1c]">{buildMatchPreviewText(match)}</div>
      </div>

      <div
        className="flex items-center justify-between border-t pt-3 transition-colors duration-300 group-hover:border-[#d9d5c9]"
        style={{ borderColor: "#eceae4", fontSize: 11, color: "#5f5f5d", textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        <span className="transition-colors duration-300 group-hover:text-[#1c1c1c]">{match.venue}</span>
        <span
          className="inline-flex items-center gap-1 -translate-x-1 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100"
          style={{ color: "#1c1c1c" }}
        >
          {linkable ? "Open dashboard" : "Fixture details"}
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </>
  );

  // Both real fixtures and curated demos flow through /match/$matchId now —
  // that route resolves either from football-data.org or the demo dataset.
  if (linkable) {
    return (
      <Link to="/match/$matchId" params={{ matchId: match.id }} className={cardClasses} style={cardStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={staticClasses} style={cardStyle}>
      {inner}
    </div>
  );
}


function TeamBlock({ code, name, muted }: { code: string; name: string; muted?: boolean }) {
  const flag = getFlagEmoji(code || name);
  return (
    <div className="flex flex-col items-center gap-1.5 font-sans">
      <div
        className="grid size-11 place-items-center rounded-full border transition-all duration-300 ease-out group-hover:scale-110 group-hover:border-[#c9c3b3] group-hover:shadow-[0_6px_16px_-8px_rgba(28,28,28,0.35)]"
        style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}
      >
        {flag ? (
          <span style={{ fontSize: 22, lineHeight: 1 }}>{flag}</span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1c" }}>{code}</span>
        )}
      </div>
      <span style={{ fontSize: 12, color: muted ? "#5f5f5d" : "#1c1c1c" }}>{name}</span>
    </div>
  );
}
