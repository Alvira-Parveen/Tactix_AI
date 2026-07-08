// Normalizes any World Cup round/stage string (from the api-football feed
// or curated match data) into one of the five canonical WC 2026 stages,
// plus the two ancillary stages (third-place, playoff).

export type Stage =
  | "Group Stage"
  | "Round of 16"
  | "Quarterfinals"
  | "Semifinals"
  | "Third-place"
  | "Final"
  | "Playoff";

export function stageFromRound(round: string | undefined | null): Stage | null {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes("group")) return "Group Stage";
  if (r.includes("16")) return "Round of 16";
  if (r.includes("quarter")) return "Quarterfinals";
  if (r.includes("semi")) return "Semifinals";
  if (r.includes("3rd") || r.includes("third")) return "Third-place";
  if (r.includes("final")) return "Final";
  if (r.includes("play")) return "Playoff";
  return null;
}

export const STAGE_STYLE: Record<Stage, string> = {
  "Group Stage": "border-primary/30 bg-primary/10 text-primary",
  "Round of 16": "border-accent/30 bg-accent/10 text-accent",
  Quarterfinals: "border-warning/30 bg-warning/10 text-warning",
  Semifinals: "border-warning/40 bg-warning/15 text-warning",
  "Third-place": "border-white/15 bg-white/5 text-muted",
  Final: "border-danger/40 bg-danger/15 text-danger",
  Playoff: "border-primary/30 bg-primary/10 text-primary",
};
