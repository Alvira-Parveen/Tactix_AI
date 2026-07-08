import { useMatchData } from "@/lib/match-context";

export function StatMatrix() {
  const { stats, winProbability, match } = useMatchData();
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {match.status === "upcoming" ? "Projected Win Probability" : "Win Probability"}
          </span>
          <span className="font-mono text-[10px] text-primary">
            {match.status === "live" ? "Live" : match.status === "upcoming" ? "Model" : "Final"}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-primary" style={{ width: `${winProbability.home}%` }} />
          <div className="h-full bg-muted/50" style={{ width: `${winProbability.draw}%` }} />
          <div className="h-full bg-danger" style={{ width: `${winProbability.away}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px]">
          <span className="text-primary">{match.home.code} {winProbability.home}%</span>
          <span className="text-muted">Draw {winProbability.draw}%</span>
          <span className="text-danger">{match.away.code} {winProbability.away}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-sm border border-border bg-card p-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">{s.label}</div>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-lg font-medium text-primary">{s.home}</span>
              <span className="text-xs text-muted">{s.away}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-primary" style={{ width: `${s.homePct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
