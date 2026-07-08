import { stageFromRound, type Stage } from "@/lib/stage";

const STAGE_COLORS: Record<Stage, { bg: string; fg: string; bd: string }> = {
  "Group Stage":  { bg: "rgba(28,28,28,0.05)",   fg: "#1c1c1c", bd: "rgba(28,28,28,0.18)" },
  "Round of 16":  { bg: "rgba(56,102,168,0.10)", fg: "#2b558f", bd: "rgba(56,102,168,0.35)" },
  Quarterfinals:  { bg: "rgba(184,122,52,0.12)", fg: "#8a5620", bd: "rgba(184,122,52,0.38)" },
  Semifinals:     { bg: "rgba(158,86,52,0.14)",  fg: "#7a3f1e", bd: "rgba(158,86,52,0.40)" },
  "Third-place":  { bg: "rgba(28,28,28,0.04)",   fg: "#5f5f5d", bd: "rgba(28,28,28,0.15)" },
  Final:          { bg: "rgba(158,42,42,0.14)",  fg: "#7a1f1f", bd: "rgba(158,42,42,0.45)" },
  Playoff:        { bg: "rgba(28,28,28,0.05)",   fg: "#1c1c1c", bd: "rgba(28,28,28,0.18)" },
};

export function StageBadge({ round, className = "" }: { round: string; className?: string }) {
  const stage = stageFromRound(round);
  if (!stage) return null;
  const c = STAGE_COLORS[stage];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${className}`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.bd }}
    >
      {stage}
    </span>
  );
}
