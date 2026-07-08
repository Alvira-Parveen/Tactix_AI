import { Link } from "@tanstack/react-router";
import { useMatchContext } from "@/lib/match-context";
import { StageBadge } from "@/components/tactix/StageBadge";

export function Scoreboard() {
  const { dataset, isLive } = useMatchContext();
  const { match } = dataset;
  const isLiveStatus = match.status === "live";
  const isFinished = match.status === "finished";

  const statusPill = isLiveStatus
    ? { text: `LIVE · ${match.minute}'`, cls: "text-danger" }
    : isFinished
      ? { text: "FULL TIME", cls: "text-muted" }
      : { text: `KICK-OFF · ${match.kickoff}`, cls: "text-primary" };

  return (
    <div className="flex items-center justify-between rounded-sm border border-border bg-card p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
          <span className="text-lg font-bold">{match.home.code}</span>
        </div>
        <span className="text-xs font-medium">{match.home.name}</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="mb-2 flex items-center gap-2">
          <StageBadge round={match.stage} />
          {isLive && (
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-primary">
              ● Live data
            </span>
          )}
        </div>
        <div className="font-mono text-4xl font-bold tracking-tighter">
          {match.homeScore} <span className="text-muted">-</span> {match.awayScore}
        </div>
        <div className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${statusPill.cls}`}>
          {statusPill.text}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-tighter text-muted">
          {match.stage} · {match.half}
        </div>
        {isLive && match.id.startsWith("fd-") && (
          <Link
            to="/fixture/$fixtureId"
            params={{ fixtureId: match.id }}
            className="mt-2 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20"
          >
            Full fixture →
          </Link>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
          <span className="text-lg font-bold">{match.away.code}</span>
        </div>
        <span className="text-xs font-medium text-muted">{match.away.name}</span>
      </div>
    </div>
  );
}
