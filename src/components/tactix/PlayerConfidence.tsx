import { AlertTriangle, Info } from "lucide-react";
import type { PlayerIntel } from "@/lib/player-intel";

// Renders a small confidence badge + optional "insufficient data" callout.
// Used on both the profile page and the compare view.

const STYLES: Record<NonNullable<PlayerIntel["dataConfidence"]>, { border: string; bg: string; text: string; label: string }> = {
  high:         { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "High confidence" },
  medium:       { border: "border-primary/40",     bg: "bg-primary/10",     text: "text-primary",     label: "Medium confidence" },
  low:          { border: "border-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Low confidence" },
  insufficient: { border: "border-danger/40",      bg: "bg-danger/10",      text: "text-danger",      label: "Insufficient data" },
};

export function ConfidenceBadge({ intel }: { intel: PlayerIntel }) {
  const c = intel.dataConfidence;
  if (!c) return null;
  const s = STYLES[c];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border ${s.border} ${s.bg} px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${s.text}`}>
      <span className={`inline-block size-1.5 rounded-full ${s.text.replace("text-", "bg-")}`} />
      {s.label}
    </span>
  );
}

export function InsufficientDataCallout({ intel }: { intel: PlayerIntel }) {
  if (intel.dataConfidence !== "insufficient") return null;
  return (
    <div className="rounded border border-danger/30 bg-danger/5 p-4">
      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-danger">
        <AlertTriangle className="size-3.5" />
        Insufficient historical data
      </div>
      <p className="text-sm text-foreground/90">
        {intel.insufficientReason ??
          "The model couldn't confidently produce match-by-match or season stats for this player. Basic bio may still be shown below."}
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted">
        For lower-profile players, try adding a club or league hint to disambiguate — or connect a live football data provider for authoritative stats.
      </p>
    </div>
  );
}

export function LowConfidenceNote({ intel }: { intel: PlayerIntel }) {
  if (intel.dataConfidence !== "low") return null;
  return (
    <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
      <p className="text-xs text-foreground/85">
        Only broad career info is reliable here — treat season and match numbers as approximate.
      </p>
    </div>
  );
}
