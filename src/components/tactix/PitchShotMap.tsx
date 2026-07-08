import { useMatchData } from "@/lib/match-context";
import type { ShotEvent } from "@/lib/match-data";

function shotColor(shot: ShotEvent) {
  if (shot.outcome === "goal") return "var(--color-primary)";
  if (shot.team === "home") return "var(--color-primary)";
  return "var(--color-danger)";
}

export function PitchShotMap() {
  const { shots, match } = useMatchData();

  return (
    <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-sm border border-border bg-card">
      <svg viewBox="0 0 100 65" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x="2" y="2" width="96" height="61" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <line x1="50" y1="2" x2="50" y2="63" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <circle cx="50" cy="32.5" r="8" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <circle cx="50" cy="32.5" r="0.5" fill="currentColor" fillOpacity="0.4" />
        <rect x="2" y="18" width="14" height="29" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <rect x="2" y="25" width="5" height="15" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <rect x="84" y="18" width="14" height="29" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
        <rect x="93" y="25" width="5" height="15" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.25" />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse at 82% 50%, color-mix(in oklab, var(--color-primary) 55%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 18% 50%, color-mix(in oklab, var(--color-danger) 30%, transparent) 0%, transparent 55%)",
        }}
      />

      <div className="absolute inset-0">
        {shots.length === 0 && (
          <div className="absolute inset-0 grid place-items-center font-mono text-[11px] uppercase tracking-widest text-muted">
            No shots yet — awaiting kickoff
          </div>
        )}
        {shots.map((shot) => {
          const size = 6 + shot.xG * 28;
          const isGoal = shot.outcome === "goal";
          return (
            <div
              key={shot.id}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
            >
              <div
                className="rounded-full transition-transform group-hover:scale-125"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: shotColor(shot),
                  opacity: isGoal ? 0.95 : 0.4,
                  boxShadow: isGoal
                    ? "0 0 18px color-mix(in oklab, var(--color-primary) 60%, transparent)"
                    : "none",
                  border: isGoal ? "2px solid var(--color-foreground)" : `1px solid ${shotColor(shot)}`,
                }}
              />
              <div className="pointer-events-none absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 rounded border border-border bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {shot.minute}' · {shot.player} · xG {shot.xG.toFixed(2)} ·{" "}
                <span className="uppercase text-muted">{shot.outcome}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Live Tactical Shot Map</span>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-primary" /> {match.home.code}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-danger" /> {match.away.code}
        </span>
      </div>
    </div>
  );
}
