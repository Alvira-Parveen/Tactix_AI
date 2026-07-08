import { useMatchContext } from "@/lib/match-context";
import type { TimelineEvent } from "@/lib/fixtures.server";

// ─── Live Tactical Timeline ───────────────────────────────────────────────
// Renders real match events (goals, cards, subs, formations) pulled from
// football-data.org. Used on /match/$matchId when the fixture is backed by
// live data — replaces the mock shot map / momentum / commentary widgets
// that require synthetic analytics we don't have from the provider.
export function LiveTimeline() {
  const { timeline, dataset } = useMatchContext();
  const { match } = dataset;

  if (!timeline || timeline.events.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Live tactical timeline
          </div>
          {match.status === "live" && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-danger">
              ● Live · {match.minute}'
            </div>
          )}
        </div>
        <p className="text-sm text-muted">
          {match.status === "upcoming"
            ? "Timeline unlocks once the referee blows the whistle."
            : "No events recorded for this fixture yet."}
        </p>
      </div>
    );
  }

  const counts = timeline.events.reduce(
    (acc, e) => {
      if (e.kind === "goal") acc.goals += 1;
      else if (e.kind === "card") acc.cards += 1;
      else if (e.kind === "sub") acc.subs += 1;
      return acc;
    },
    { goals: 0, cards: 0, subs: 0 },
  );

  const sorted = [...timeline.events].sort((a, b) => b.minute - a.minute);

  return (
    <div className="rounded-sm border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Match events · football-data.org
        </div>
        <div className="flex items-center gap-3">
          {match.status === "live" && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-danger">
              ● Live · {match.minute}'
            </span>
          )}
          <div className="flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-muted">
            <span>⚽ {counts.goals}</span>
            <span>🟨 {counts.cards}</span>
            <span>🔁 {counts.subs}</span>
          </div>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {sorted.map((e, i) => (
          <TimelineRow
            key={i}
            event={e}
            homeCode={match.home.code}
            awayCode={match.away.code}
          />
        ))}
      </ol>

      {timeline.synthesized && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted">
          Scorer &amp; exact minute unavailable from data provider — approximate half only.
        </p>
      )}
    </div>
  );
}

function TimelineRow({
  event,
  homeCode,
  awayCode,
}: {
  event: TimelineEvent;
  homeCode: string;
  awayCode: string;
}) {
  const teamCode = event.teamSide === "home" ? homeCode : awayCode;
  const isSynthesizedGoal =
    event.kind === "goal" && event.scorer === "Scorer unavailable";
  const minuteLabel =
    event.kind === "goal" && event.injuryTime
      ? `${event.minute}+${event.injuryTime}'`
      : isSynthesizedGoal
        ? event.minute <= 45 ? "1st half" : "2nd half"
        : `${event.minute}'`;

  let icon = "•";
  let title = "";
  let sub: string | null = null;
  let tone = "border-white/10";
  // Kind-specific hover/focus/active tints so goals, cards, subs and
  // formations all get the same emphasis treatment but stay visually distinct.
  let hoverBg = "rgba(255,255,255,0.06)";
  let activeBg = "rgba(255,255,255,0.10)";
  let ringColor = "rgba(255,255,255,0.35)";

  if (event.kind === "goal") {
    icon = "⚽";
    tone = "border-primary/40 bg-primary/5";
    hoverBg = "color-mix(in oklab, var(--primary) 12%, transparent)";
    activeBg = "color-mix(in oklab, var(--primary) 20%, transparent)";
    ringColor = "color-mix(in oklab, var(--primary) 60%, transparent)";
    const suffix = event.goalType && event.goalType !== "regular" ? ` (${event.goalType})` : "";
    title = isSynthesizedGoal ? `Goal — ${teamCode}` : `${event.scorer}${suffix} — ${teamCode}`;
    const scoreStr = event.score ? `${event.score.home}–${event.score.away}` : null;
    sub = isSynthesizedGoal
      ? "Scorer details not provided by data source"
      : [event.assist ? `Assist: ${event.assist}` : null, scoreStr].filter(Boolean).join(" · ") || null;
  } else if (event.kind === "card") {
    const isRed = event.card === "RED" || event.card === "YELLOW_RED";
    icon = isRed ? "🟥" : "🟨";
    tone = isRed ? "border-danger/40 bg-danger/5" : "border-white/10";
    const accent = isRed ? "var(--danger)" : "var(--warning, #d4a017)";
    hoverBg = `color-mix(in oklab, ${accent} 12%, transparent)`;
    activeBg = `color-mix(in oklab, ${accent} 20%, transparent)`;
    ringColor = `color-mix(in oklab, ${accent} 60%, transparent)`;
    title = `${event.player} — ${event.card.replace("_", " ").toLowerCase()}`;
    sub = teamCode;
  } else if (event.kind === "sub") {
    icon = "🔁";
    hoverBg = "color-mix(in oklab, #4a9d5f 14%, transparent)";
    activeBg = "color-mix(in oklab, #4a9d5f 24%, transparent)";
    ringColor = "color-mix(in oklab, #4a9d5f 60%, transparent)";
    title = `${event.playerIn} on for ${event.playerOut}`;
    sub = teamCode;
  } else if (event.kind === "formation") {
    icon = "🧭";
    hoverBg = "color-mix(in oklab, #6b8ac6 14%, transparent)";
    activeBg = "color-mix(in oklab, #6b8ac6 24%, transparent)";
    ringColor = "color-mix(in oklab, #6b8ac6 60%, transparent)";
    title = `${teamCode} lined up ${event.formation}`;
    sub = "Starting shape";
  }

  return (
    <li
      tabIndex={0}
      style={
        {
          ["--row-hover" as string]: hoverBg,
          ["--row-active" as string]: activeBg,
          ["--row-ring" as string]: ringColor,
        } as React.CSSProperties
      }
      className={`group flex items-start gap-3 rounded border p-3 outline-none transition-[background-color,transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--row-hover)] hover:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.6)] focus-visible:bg-[var(--row-hover)] focus-visible:shadow-[0_0_0_2px_var(--row-ring)] active:translate-y-0 active:bg-[var(--row-active)] ${tone}`}
    >
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full border border-white/10 text-xs transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95"
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-foreground transition-colors duration-200 group-hover:text-foreground">{title}</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted transition-colors duration-200 group-hover:text-foreground">
            {minuteLabel}
          </span>
        </div>
        {sub && <div className="mt-0.5 text-xs text-muted transition-colors duration-200 group-hover:text-foreground/80">{sub}</div>}
      </div>
    </li>
  );
}
