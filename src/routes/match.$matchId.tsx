import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/tactix/TopNav";
import { TacticalFeed } from "@/components/tactix/TacticalFeed";
import { Scoreboard } from "@/components/tactix/Scoreboard";
import { PitchShotMap } from "@/components/tactix/PitchShotMap";
import { MomentumGraph } from "@/components/tactix/MomentumGraph";
import { StatMatrix } from "@/components/tactix/StatMatrix";
import { ChatAssistant } from "@/components/tactix/ChatAssistant";
import { DangerFeed } from "@/components/tactix/DangerFeed";
import { PlayerRatings } from "@/components/tactix/PlayerRatings";
import { AIMatchCommentary } from "@/components/tactix/AIMatchCommentary";
import { ShareButton } from "@/components/tactix/ShareButton";
import { LiveTimeline } from "@/components/tactix/LiveTimeline";
import { MatchProvider } from "@/lib/match-context";
import { MATCHES } from "@/lib/match-data";
import { getMatchDashboard } from "@/lib/fixtures.functions";
import type { MatchInsightSummary } from "@/lib/fixtures.functions";

const matchDashboardQueryOptions = (matchId: string) =>
  queryOptions({
    queryKey: ["match-dashboard", matchId],
    queryFn: () => getMatchDashboard({ data: { matchId } }),
    // Live fixtures update frequently; refetch every 30s to keep the
    // scoreboard, minute and timeline in sync across the whole page.
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

export const Route = createFileRoute("/match/$matchId")({
  validateSearch: (search: Record<string, unknown>) => ({
    ask: typeof search.ask === "string" ? search.ask : undefined,
  }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(matchDashboardQueryOptions(params.matchId));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Match unavailable — TACTIX AI" }, { name: "robots", content: "noindex" }] };
    }
    const { match } = loaderData.dataset;
    const title = `${match.home.name} vs ${match.away.name} — ${match.stage} · TACTIX AI`;
    const description = `Live AI tactical analysis for ${match.home.name} vs ${match.away.name} (${match.stage}, ${match.competition}).`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  pendingComponent: MatchPending,
  pendingMs: 200,
  component: MatchDashboard,
  notFoundComponent: MatchNotFound,
  errorComponent: MatchError,
});

function LiveInsightsPanel({ liveInsights }: { liveInsights: MatchInsightSummary }) {
  return (
    <section className="col-span-12 rounded border border-border bg-surface/40 p-4 lg:col-span-3">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Live insight summary</div>
      <p className="text-sm leading-relaxed text-foreground/90">{liveInsights.summary}</p>
      <div className="mt-3 space-y-2">
        {liveInsights.keyMoments.slice(0, 2).map((item) => (
          <div key={item} className="rounded border border-border bg-background/40 p-2 text-xs text-muted">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchDashboard() {
  const { matchId } = Route.useParams();
  const { data } = useSuspenseQuery(matchDashboardQueryOptions(matchId));
  const { ask } = Route.useSearch();
  const { dataset, isLive, timeline, liveInsights } = data!;
  const { match } = dataset;
  const minuteLabel = match.status === "live" ? `${match.minute.toString().padStart(2, "0")}'` : match.half;

  return (
    <MatchProvider dataset={dataset} isLive={isLive} timeline={timeline}>
      <div className="min-h-screen bg-background pb-16 font-sans text-foreground selection:bg-primary/30">
        <TopNav />

        <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 p-6">
          <TacticalFeed minute={minuteLabel} />
            {liveInsights && <LiveInsightsPanel liveInsights={liveInsights} />}
          <section className="col-span-12 flex flex-col gap-6 lg:col-span-6">
            <DangerFeed />
            <Scoreboard />
            {isLive ? (
              <LiveTimeline />
            ) : (
              <>
                <PitchShotMap />
                <MomentumGraph />
                <AIMatchCommentary />
              </>
            )}
          </section>

          <section className="col-span-12 flex flex-col gap-6 lg:col-span-3">
            <StatMatrix />
            {!isLive && <PlayerRatings />}
            <ChatAssistant prefill={ask} />
          </section>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-50 flex h-10 items-center justify-between border-t border-border bg-background/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-6 font-mono text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className={match.status === "live" ? "text-danger" : "text-muted"}>●</span>{" "}
              {match.status === "live" ? "LIVE SIGNAL" : match.status === "upcoming" ? "PRE-MATCH MODEL" : "POST-MATCH REPORT"}
            </span>
            <span className="hidden md:inline">SOURCE: {isLive ? "FOOTBALL-DATA.ORG" : "TACTIX-CHRONOS-2"}</span>
          </div>
          <div className="flex items-center gap-4">
            <ShareButton
              title={`${match.home.name} vs ${match.away.name} — TACTIX AI`}
              text="Live AI tactical dashboard"
            />
            {!isLive && (
              <Link
                to="/intel/$matchId"
                params={{ matchId: match.id }}
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80"
              >
                Tactical Intel →
              </Link>
            )}
            <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-foreground">
              ← Hub
            </Link>
          </div>
        </footer>
      </div>
    </MatchProvider>
  );
}

function StateShell({
  eyebrow,
  title,
  children,
  tone = "danger",
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  tone?: "danger" | "muted";
}) {
  const toneClass = tone === "danger" ? "text-danger" : "text-muted";
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="w-full max-w-lg">
        <div className={`mb-3 font-mono text-[10px] uppercase tracking-widest ${toneClass}`}>{eyebrow}</div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function MatchPending() {
  return (
    <StateShell eyebrow="Loading match" title="Syncing tactical feed…" tone="muted">
      <div className="space-y-3">
        <div className="skeleton h-24 rounded border border-border" />
        <div className="grid grid-cols-3 gap-3">
          <div className="skeleton h-20 rounded border border-border" />
          <div className="skeleton h-20 rounded border border-border" />
          <div className="skeleton h-20 rounded border border-border" />
        </div>
        <div className="skeleton h-40 rounded border border-border" />
        <div className="skeleton h-24 rounded border border-border" />
      </div>
    </StateShell>
  );
}

function AvailableMatchesList() {
  if (!MATCHES.length) {
    return <p className="text-sm text-muted">No fixtures are currently available.</p>;
  }
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Available fixtures</div>
      <ul className="divide-y divide-border rounded border border-border bg-surface/40">
        {MATCHES.slice(0, 6).map((m) => (
          <li key={m.id}>
            <Link
              to="/match/$matchId"
              params={{ matchId: m.id }}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-primary/5"
            >
              <span className="truncate">
                {m.home.name} <span className="text-muted">vs</span> {m.away.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {m.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackToHub() {
  return (
    <Link
      to="/"
      className="inline-block rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
    >
      ← Back to Match Hub
    </Link>
  );
}

function MatchNotFound() {
  const { matchId } = Route.useParams();
  return (
    <StateShell eyebrow="Match not found" title={`No fixture matches "${matchId}"`}>
      <p className="mb-6 text-sm text-muted">
        The fixture may have been removed, hasn't been added yet, or the link is incorrect.
      </p>
      <div className="mb-6">
        <AvailableMatchesList />
      </div>
      <BackToHub />
    </StateShell>
  );
}

function MatchError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const message = error?.message?.trim() || "An unexpected error occurred while loading this match.";
  const handleRetry = async () => {
    await router.invalidate();
    reset();
  };
  return (
    <StateShell eyebrow="Match dashboard error" title="Could not load this match">
      <p className="mb-2 text-sm text-muted">We couldn't render the tactical feed for this fixture.</p>
      <pre className="mb-6 overflow-x-auto rounded border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger/90">
        {message}
      </pre>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          ↻ Retry
        </button>
        <BackToHub />
      </div>
      <AvailableMatchesList />
    </StateShell>
  );
}
