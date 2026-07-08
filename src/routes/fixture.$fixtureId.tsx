import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { getFixtureDetail } from "@/lib/fixtures.functions";
import { getFlagEmoji, type MatchState } from "@/lib/match-data";

const fixtureQueryOptions = (fixtureId: string) =>
  queryOptions({
    queryKey: ["fixture", fixtureId],
    queryFn: () => getFixtureDetail({ data: { fixtureId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/fixture/$fixtureId")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(fixtureQueryOptions(params.fixtureId));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Fixture unavailable — TACTIX AI" }, { name: "robots", content: "noindex" }] };
    }
    const { match } = loaderData;
    const title = `${match.home.name} vs ${match.away.name} — ${match.stage} · TACTIX AI`;
    const description = `Live info and AI tactical brief for ${match.home.name} vs ${match.away.name} (${match.competition}, ${match.stage}).`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: FixtureDetailPage,
  pendingComponent: FixturePending,
  pendingMs: 150,
  notFoundComponent: () => (
    <div className="theme-cream min-h-screen">
      <div className="mx-auto max-w-2xl p-10">
        <p style={{ color: "#5f5f5d" }}>This fixture isn't available.</p>
        <Link to="/" className="btn-inset mt-4 inline-block">Back to Match Hub</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="theme-cream min-h-screen">
      <div className="mx-auto max-w-2xl p-10">
        <p style={{ color: "#5f5f5d" }}>Couldn't load fixture: {error.message}</p>
        <Link to="/" className="btn-inset mt-4 inline-block">Back to Match Hub</Link>
      </div>
    </div>
  ),
});

function FixturePending() {
  return (
    <div className="theme-cream min-h-screen pb-24">
      <div className="mx-auto max-w-[900px] px-6 pt-16">
        <div className="skeleton h-3 w-64 rounded" />
        <div className="skeleton mt-6 h-10 w-4/5 rounded" />
        <div className="mt-8 rounded-2xl border p-8" style={{ borderColor: "#eceae4", backgroundColor: "#f7f4ed" }}>
          <div className="grid grid-cols-3 items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="skeleton h-6 w-14 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="skeleton h-12 w-32 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="skeleton h-6 w-14 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
          </div>
        </div>
        <div className="mt-10 space-y-3">
          <div className="skeleton h-6 w-40 rounded" />
          <div className="skeleton h-16 rounded-2xl border" style={{ borderColor: "#eceae4" }} />
          <div className="skeleton h-16 rounded-2xl border" style={{ borderColor: "#eceae4" }} />
          <div className="skeleton h-16 rounded-2xl border" style={{ borderColor: "#eceae4" }} />
        </div>
      </div>
    </div>
  );
}

function FixtureDetailPage() {
  const { fixtureId } = Route.useParams();
  const { data } = useSuspenseQuery(fixtureQueryOptions(fixtureId));
  const { match, timeline } = data!;

  const brief = useQuery({
    queryKey: ["fixture-brief", fixtureId],
    queryFn: async () => {
      const res = await fetch("/api/fixture-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as {
        brief: string | null;
        summary?: string;
        keyMoments?: string[];
        tacticalNotes?: string[];
        nextActions?: string[];
        error?: string;
      };
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="theme-cream min-h-screen pb-24">
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
          <Link to="/" className="btn-ghost-cream text-[14px]">← All fixtures</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[900px] px-6 pt-16">
        <div className="flex items-center gap-2" style={{ fontSize: 12, color: "#5f5f5d", letterSpacing: "0.02em" }}>
          <span>{match.competition}</span>
          <span>·</span>
          <span>{match.stage}</span>
          <span>·</span>
          <StatusPill match={match} />
        </div>

        <h1 className="mt-6" style={{
          fontFamily: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
          fontSize: "clamp(36px, 5vw, 52px)",
          fontWeight: 600, lineHeight: 1.05, letterSpacing: "-1.2px", color: "#1c1c1c",
        }}>
          {match.home.name} <span style={{ color: "#5f5f5d" }}>vs</span> {match.away.name}
        </h1>

        <div className="mt-8 rounded-2xl border p-8" style={{ borderColor: "#eceae4", backgroundColor: "#f7f4ed" }}>
          <div className="grid grid-cols-3 items-center gap-6">
            <div className="text-center">
              <div style={{ fontSize: 22, fontWeight: 600, color: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>{getFlagEmoji(match.home.code || match.home.name)}</span>
                <span>{match.home.code}</span>
              </div>
              <div className="mt-1" style={{ fontSize: 13, color: "#5f5f5d" }}>{match.home.name}</div>
              {timeline.homeFormation && (
                <div className="mt-2 inline-block rounded-full border px-2 py-0.5" style={{ borderColor: "#eceae4", fontSize: 11, color: "#5f5f5d", letterSpacing: "0.06em" }}>
                  {timeline.homeFormation}
                </div>
              )}
            </div>
            <div className="text-center">
              {match.status === "upcoming" ? (
                <div style={{ fontSize: 32, fontWeight: 600, color: "#5f5f5d", letterSpacing: "-1px" }}>vs</div>
              ) : (
                <div style={{ fontSize: 56, fontWeight: 600, color: "#1c1c1c", letterSpacing: "-2px", lineHeight: 1, display: "flex", alignItems: "baseline", justifyContent: "center" }}>
                  <span>{match.homeScore}</span>
                  {match.homePens !== undefined && (
                    <span style={{ fontSize: 24, fontWeight: 400, color: "#5f5f5d", marginLeft: 4 }}>({match.homePens})</span>
                  )}
                  <span style={{ color: "#5f5f5d", margin: "0 10px" }}>–</span>
                  <span>{match.awayScore}</span>
                  {match.awayPens !== undefined && (
                    <span style={{ fontSize: 24, fontWeight: 400, color: "#5f5f5d", marginLeft: 4 }}>({match.awayPens})</span>
                  )}
                </div>
              )}
              <div className="mt-2" style={{ fontSize: 12, color: "#5f5f5d", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {match.status === "upcoming" ? match.kickoff : match.half}
              </div>
            </div>
            <div className="text-center">
              <div style={{ fontSize: 22, fontWeight: 600, color: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>{getFlagEmoji(match.away.code || match.away.name)}</span>
                <span>{match.away.code}</span>
              </div>
              <div className="mt-1" style={{ fontSize: 13, color: "#5f5f5d" }}>{match.away.name}</div>
              {timeline.awayFormation && (
                <div className="mt-2 inline-block rounded-full border px-2 py-0.5" style={{ borderColor: "#eceae4", fontSize: 11, color: "#5f5f5d", letterSpacing: "0.06em" }}>
                  {timeline.awayFormation}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: "#eceae4", fontSize: 12, color: "#5f5f5d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>{match.venue}</span>
            <span suppressHydrationWarning>{match.status === "live" ? `Minute ${match.minute}` : match.status === "finished" ? "Finished" : "Scheduled"}</span>
          </div>
        </div>

        <TacticalTimeline timeline={timeline} match={match} />

        <section className="mt-10">
          <h2 className="mb-4" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px", color: "#1c1c1c" }}>
            AI tactical brief
          </h2>
          {brief.isLoading && (
            <p style={{ color: "#5f5f5d", fontSize: 14 }}>Analyst is thinking…</p>
          )}
          {brief.isError && (
            <p style={{ color: "#5f5f5d", fontSize: 14 }}>Analysis unavailable right now.</p>
          )}
          {brief.data?.brief && (
            <div
              className="rounded-2xl border p-6"
              style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8", fontSize: 15, lineHeight: 1.7, color: "#1c1c1c", whiteSpace: "pre-wrap" }}
            >
              {brief.data.summary && (
                <div className="mb-4 rounded border border-[#eceae4] bg-[#f7f4ed] p-3" style={{ fontSize: 14 }}>
                  <div className="mb-2 font-semibold" style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Tactical snapshot</div>
                  <p className="mb-3">{brief.data.summary}</p>
                  <div className="space-y-2">
                    {brief.data.keyMoments?.slice(0, 2).map((item) => (
                      <div key={item} className="rounded border border-[#eceae4] bg-[#fcfbf8] p-2" style={{ fontSize: 13 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {brief.data.brief}
            </div>
          )}
          {brief.data && !brief.data.brief && (
            <p style={{ color: "#5f5f5d", fontSize: 14 }}>
              {brief.data.error ?? "No analysis available for this fixture."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function TacticalTimeline({
  timeline,
  match,
}: {
  timeline: import("@/lib/fixtures.server").FixtureTimeline;
  match: MatchState;
}) {
  const { events, synthesized, sourceNote, source } = timeline;

  const SourcePill = () => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
      style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8", fontSize: 11, color: "#5f5f5d", letterSpacing: "0.02em" }}
      title="Where this timeline came from"
    >
      <span
        className="size-1.5 rounded-full"
        style={{
          backgroundColor:
            source === "full" || source === "enriched" ? "#4a9d5f" : source === "synthesized" ? "#c88a2a" : "#a0a0a0",
        }}
        aria-hidden
      />
      {sourceNote}
    </span>
  );

  if (events.length === 0) {
    return (
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px", color: "#1c1c1c" }}>
            Match events
          </h2>
          <SourcePill />
        </div>
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8", fontSize: 14, color: "#5f5f5d" }}
        >
          {match.status === "upcoming"
            ? "Timeline unlocks once the referee blows the whistle."
            : match.status === "live"
              ? <>Match is live at <span suppressHydrationWarning>{match.minute}</span>' — the data provider hasn't published any events yet. This section will populate as goals, cards, and substitutions come in.</>
              : "The data provider didn't record any events for this fixture."}
        </div>
      </section>
    );
  }

  const counts = events.reduce(
    (acc, e) => {
      if (e.kind === "goal") acc.goals += 1;
      else if (e.kind === "card") acc.cards += 1;
      else if (e.kind === "sub") acc.subs += 1;
      else if (e.kind === "formation") acc.formations += 1;
      return acc;
    },
    { goals: 0, cards: 0, subs: 0, formations: 0 },
  );

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px", color: "#1c1c1c" }}>
          Match events
        </h2>
        <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 12, color: "#5f5f5d", letterSpacing: "0.02em" }}>
          {match.status === "live" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-danger">
              <span className="size-1.5 animate-[pulse-glow_2s_infinite] rounded-full bg-danger" />
              Live · <span suppressHydrationWarning>{match.minute}</span>'
            </span>
          )}
          <SourcePill />
          <span>⚽ {counts.goals} goals</span>
          <span>🟨 {counts.cards} cards</span>
          <span>🔁 {counts.subs} subs</span>
          {counts.formations > 0 && <span>🧭 {counts.formations} formations</span>}
        </div>
      </div>

      <ol
        className="relative rounded-2xl border p-4 pl-8 sm:pl-10"
        style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}
      >
        <div
          className="absolute top-4 bottom-4 w-px"
          style={{ left: "1.5rem", backgroundColor: "#eceae4" }}
          aria-hidden
        />
        {events.map((e, i) => (
          <TimelineRow key={i} event={e} match={match} />
        ))}
      </ol>

      {synthesized && (
        <p className="mt-3" style={{ fontSize: 12, color: "#5f5f5d" }}>
          Scorer names weren't provided by the data source. Goal minutes are estimated from the score progression and match clock.
        </p>
      )}
    </section>
  );
}

function TimelineRow({
  event,
  match,
}: {
  event: import("@/lib/fixtures.server").TimelineEvent;
  match: MatchState;
}) {
  const teamName = event.teamSide === "home" ? match.home.code : match.away.code;
  const isSynthesizedGoal =
    event.kind === "goal" && event.scorer === "Scorer unavailable";
  const minuteLabel =
    event.kind === "goal" && event.injuryTime
      ? `${event.minute}+${event.injuryTime}'`
      : isSynthesizedGoal
        ? event.minute <= 45 ? "1st half" : "2nd half"
        : `${event.minute}'`;

  let icon = "•";
  let bg = "#eceae4";
  let title = "";
  let sub: string | null = null;
  // Kind-specific tinted hover/focus/active surfaces (goals = amber,
  // cards = warning, subs = green, formations = blue). Keeps the emphasis
  // treatment consistent while still visually distinguishing event types.
  let hoverBg = "#f3efe5";
  let activeBg = "#ece7d9";
  let ringColor = "rgba(28,28,28,0.35)";

  if (event.kind === "goal") {
    icon = "⚽";
    bg = "#f4ead9";
    hoverBg = "#f8ecd2";
    activeBg = "#f0e0bd";
    ringColor = "rgba(180,120,40,0.55)";
    const suffix = event.goalType && event.goalType !== "regular" ? ` (${event.goalType})` : "";
    title = isSynthesizedGoal ? `Goal — ${teamName}` : `${event.scorer}${suffix} — ${teamName}`;
    const scoreStr = event.score ? `Score: ${event.score.home}–${event.score.away}` : null;
    sub = isSynthesizedGoal
      ? "Scorer details not provided by data source"
      : [event.assist ? `Assist: ${event.assist}` : null, scoreStr].filter(Boolean).join(" · ") || null;
  } else if (event.kind === "card") {
    const map: Record<string, { icon: string; bg: string; label: string; hover: string; active: string; ring: string }> = {
      YELLOW: { icon: "🟨", bg: "#faf3d6", label: "Yellow card", hover: "#f8eebd", active: "#f2e59f", ring: "rgba(180,150,40,0.6)" },
      RED: { icon: "🟥", bg: "#f6d7d0", label: "Red card", hover: "#f4c8bd", active: "#eeb2a4", ring: "rgba(200,60,50,0.55)" },
      YELLOW_RED: { icon: "🟨🟥", bg: "#f6d7d0", label: "Second yellow", hover: "#f4c8bd", active: "#eeb2a4", ring: "rgba(200,60,50,0.55)" },
      UNKNOWN: { icon: "🟨", bg: "#faf3d6", label: "Booking", hover: "#f8eebd", active: "#f2e59f", ring: "rgba(180,150,40,0.6)" },
    };
    const c = map[event.card];
    icon = c.icon;
    bg = c.bg;
    hoverBg = c.hover;
    activeBg = c.active;
    ringColor = c.ring;
    title = `${c.label} — ${event.player}`;
    sub = teamName;
  } else if (event.kind === "sub") {
    icon = "🔁";
    bg = "#e6efe4";
    hoverBg = "#d9ead6";
    activeBg = "#c8dfc4";
    ringColor = "rgba(60,130,80,0.55)";
    title = `Substitution — ${teamName}`;
    sub = `${event.playerIn} on for ${event.playerOut}`;
  } else if (event.kind === "formation") {
    icon = "🧭";
    bg = "#e6ecf5";
    hoverBg = "#d8e2f0";
    activeBg = "#c6d4e8";
    ringColor = "rgba(60,90,180,0.5)";
    title = `Formation ${event.formation} — ${teamName}`;
    sub = "Starting shape";
  }

  return (
    <li
      className="group relative flex items-start gap-3 rounded-lg py-2.5 pl-2 pr-3 outline-none transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--row-hover)] hover:shadow-[0_6px_18px_-14px_rgba(28,28,28,0.5)] focus-visible:bg-[var(--row-hover)] focus-visible:shadow-[0_0_0_2px_var(--row-ring)] active:translate-y-0 active:bg-[var(--row-active)]"
      tabIndex={0}
      style={
        {
          ["--row-hover" as string]: hoverBg,
          ["--row-active" as string]: activeBg,
          ["--row-ring" as string]: ringColor,
        } as React.CSSProperties
      }
    >
      <span
        className="absolute -translate-x-1/2 grid size-5 place-items-center rounded-full border transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95"
        style={{ left: "0.5rem", top: "0.85rem", borderColor: "#eceae4", backgroundColor: bg, fontSize: 11 }}
        aria-hidden
      >
        {icon}
      </span>
      <div className="ml-4 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="transition-colors duration-200 group-hover:text-[color:#0f0f0f]"
            style={{ fontSize: 14, color: "#1c1c1c", fontWeight: 500 }}
          >
            {title}
          </span>
          <span
            className="font-mono transition-colors duration-200 group-hover:text-[color:#1c1c1c]"
            style={{ fontSize: 11, color: "#5f5f5d", letterSpacing: "0.06em" }}
          >
            {minuteLabel}
          </span>
        </div>
        {sub && (
          <div
            className="mt-0.5 transition-colors duration-200 group-hover:text-[color:#3a3a37]"
            style={{ fontSize: 12, color: "#5f5f5d" }}
          >
            {sub}
          </div>
        )}
      </div>
    </li>
  );
}

function StatusPill({ match }: { match: MatchState }) {
  if (match.status === "live") {
    return (
      <span suppressHydrationWarning className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-danger">
        <span className="size-1.5 animate-[pulse-glow_2s_infinite] rounded-full bg-danger" />
        Live · {match.minute}'
      </span>
    );
  }
  if (match.status === "finished") {
    return <span style={{ fontSize: 12, color: "#5f5f5d" }}>Full time</span>;
  }
  return <span style={{ fontSize: 12, color: "#5f5f5d" }}>{match.kickoff}</span>;
}
