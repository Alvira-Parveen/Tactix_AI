import { createContext, useContext, type ReactNode } from "react";
import type { MatchDataset } from "@/lib/match-data";
import type { FixtureTimeline } from "@/lib/fixtures.server";

export type MatchContextValue = {
  dataset: MatchDataset;
  /** True when the dataset was built from a real football-data.org fixture. */
  isLive: boolean;
  /** Real match events (goals, cards, subs, formations) when available. */
  timeline: FixtureTimeline | null;
};

const MatchContext = createContext<MatchContextValue | null>(null);

export function MatchProvider({
  dataset,
  isLive = false,
  timeline = null,
  children,
}: {
  dataset: MatchDataset;
  isLive?: boolean;
  timeline?: FixtureTimeline | null;
  children: ReactNode;
}) {
  return (
    <MatchContext.Provider value={{ dataset, isLive, timeline }}>
      {children}
    </MatchContext.Provider>
  );
}

/** Back-compat: returns the raw dataset (spread) so existing consumers keep working. */
export function useMatchData(): MatchDataset {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error("useMatchData must be used inside <MatchProvider>");
  return ctx.dataset;
}

/** Full context including live-mode flag and timeline. */
export function useMatchContext(): MatchContextValue {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error("useMatchContext must be used inside <MatchProvider>");
  return ctx;
}
