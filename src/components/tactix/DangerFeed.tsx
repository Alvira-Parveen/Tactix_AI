import { useMatchData } from "@/lib/match-context";
import { detectDangerousAttacks, type DangerAlert } from "@/lib/agents/tactical";

// ─── Dangerous attack banner ──────────────────────────────────────────────
// Surfaces the top-3 most recent dangerous-attack detections above the
// scoreboard. Deterministic; sourced from the tactical agent.

const INTENSITY_STYLES: Record<DangerAlert["intensity"], { border: string; bg: string; text: string; dot: string; label: string }> = {
  critical: { border: "border-danger/60", bg: "bg-danger/15", text: "text-danger", dot: "bg-danger", label: "Critical" },
  high: { border: "border-danger/40", bg: "bg-danger/10", text: "text-danger", dot: "bg-danger", label: "High" },
  elevated: { border: "border-primary/40", bg: "bg-primary/10", text: "text-primary", dot: "bg-primary", label: "Elevated" },
};

export function DangerFeed() {
  const dataset = useMatchData();
  const alerts = detectDangerousAttacks(dataset).slice(0, 3);

  if (alerts.length === 0) return null;

  return (
    <div className="rounded border border-danger/30 bg-danger/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-danger">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-danger" />
          Dangerous attacks detected
        </div>
        <span className="font-mono text-[10px] text-muted">{alerts.length} active</span>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((a) => {
          const style = INTENSITY_STYLES[a.intensity];
          return (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-3 rounded border ${style.border} ${style.bg} px-2.5 py-1.5`}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block size-1.5 rounded-full ${style.dot}`} />
                <span className={`font-mono text-[10px] uppercase tracking-wider ${style.text}`}>
                  {a.minute}′ · {style.label}
                </span>
                <span className="text-xs text-foreground/90">{a.headline}</span>
              </div>
              <span className="hidden font-mono text-[10px] text-muted sm:inline">
                {a.channel} · {a.xGSum} xG · {a.shotCount} shot{a.shotCount === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
