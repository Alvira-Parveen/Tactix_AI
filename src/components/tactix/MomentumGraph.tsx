import { useMatchData } from "@/lib/match-context";

export function MomentumGraph() {
  const { momentum, winProbability, match } = useMatchData();
  const width = 600;
  const height = 90;
  const midY = height / 2;

  if (momentum.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
          <span>Momentum Tracker · 90'</span>
          <span>
            Projected: <span className="text-primary">{match.home.code} {winProbability.home}%</span>
          </span>
        </div>
        <div className="grid h-24 place-items-center font-mono text-[10px] uppercase tracking-widest text-muted">
          Match has not started
        </div>
      </div>
    );
  }

  const step = width / Math.max(1, momentum.length - 1);
  const points = momentum.map((v, i) => `${i * step},${midY - v * (height / 2 - 6)}`).join(" ");
  const areaPoints = `0,${midY} ${points} ${width},${midY}`;

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
        <span>Momentum Tracker · 90'</span>
        <span>
          Win Prob: <span className="text-primary">{match.home.code} {winProbability.home}%</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
        <line x1="0" x2={width} y1={midY} y2={midY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" strokeWidth="1" />
        <polygon points={areaPoints} fill="var(--color-primary)" fillOpacity="0.15" style={{ animation: "draw-line 1.2s var(--ease-out-expo) both" }} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "draw-line 1.2s var(--ease-out-expo) both" }}
        />
        <circle
          cx={(momentum.length - 1) * step}
          cy={midY - momentum[momentum.length - 1] * (height / 2 - 6)}
          r="4"
          fill="var(--color-primary)"
          style={{ filter: "drop-shadow(0 0 6px var(--color-primary))" }}
        />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>0'</span>
        <span>HT</span>
        <span>90'</span>
      </div>
    </div>
  );
}
