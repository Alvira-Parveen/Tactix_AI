import type { MatchState, StatBlock, WinProbability } from "./match-data";

export type LiveInsightPayload = {
  summary: string;
  keyMoments: string[];
  tacticalNotes: string[];
  nextActions: string[];
};

export type FixtureBriefPayload = LiveInsightPayload & {
  brief: string;
};

function scoreLabel(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home team leading";
  if (awayScore > homeScore) return "away team leading";
  return "level";
}

export function buildLiveInsightPayload(
  match: MatchState,
  stats: StatBlock[] = [],
  winProbability?: WinProbability,
): LiveInsightPayload {
  const possession = stats.find((s) => s.label.toLowerCase().includes("possession"));
  const xg = stats.find((s) => s.label.toLowerCase().includes("xg"));
  const homePct = possession?.homePct ?? 50;
  const homeXg = xg ? Number.parseFloat(xg.home) : 0;
  const awayXg = xg ? Number.parseFloat(xg.away) : 0;
  const lead = scoreLabel(match.homeScore, match.awayScore);

  const summary = match.status === "live"
    ? `${match.home.name} are ${lead} at ${match.minute}' and the game state is forcing the next phase of the match.`
    : match.status === "upcoming"
      ? `${match.home.name} vs ${match.away.name} is approaching kickoff, and the opening pattern should be shaped by the first 10 minutes.`
      : `${match.home.name} vs ${match.away.name} has finished. The result reflects the tactical balance that emerged over the match.`;

  const keyMoments = [
    homePct >= 55 ? `${match.home.name} are likely to control territory through structured build-up.` : `${match.home.name} are likely to rely on direct transitions when the ball turns over.`,
    awayXg > homeXg ? `${match.away.name} are carrying the sharper chance quality.` : `${match.home.name} are carrying the sharper chance quality.`,
    winProbability ? `Win probability currently favors ${match.home.name} at ${winProbability.home}% versus ${winProbability.away}% for ${match.away.name}.` : "The game state is still fluid and a single action can change the narrative.",
  ];

  const tacticalNotes = [
    match.status === "live" ? "A compact defensive block is likely to protect a lead, while chasing teams will increase verticality." : "The opening structure should focus on width and quick switches before the press becomes more aggressive.",
    match.status !== "finished" ? "A single turnover or set-piece can flip the attacking rhythm quickly." : "The final phase of the match was shaped by defensive recovery and transition efficiency.",
  ];

  const nextActions = [
    match.status === "live" ? `Watch the wide channel in the next 10 minutes for the clearest chance creation route.` : `Watch the first 10 minutes for the clearest opening pattern.`,
    match.status !== "finished" ? `The next tactical change should target the side of the pitch with the highest overload. ` : `The main tactical lesson is how the team that stayed compact created cleaner chances.`,
  ];

  return { summary, keyMoments, tacticalNotes, nextActions };
}

export function buildFixtureBriefPayload(
  match: MatchState,
  stats: StatBlock[] = [],
  winProbability?: WinProbability,
): FixtureBriefPayload {
  const insight = buildLiveInsightPayload(match, stats, winProbability);
  const brief = [
    `${match.home.name} vs ${match.away.name} is ${match.status === "upcoming" ? "upcoming" : match.status === "live" ? "live" : "finished"}. ${insight.summary}`,
    insight.keyMoments[0],
    insight.tacticalNotes[0],
    insight.nextActions[0],
  ].join(" ");

  return { ...insight, brief: brief.slice(0, 320) };
}

export function buildMatchPreviewText(match: MatchState): string {
  const insight = buildLiveInsightPayload(match);
  const preview = insight.summary.length > 120 ? `${insight.summary.slice(0, 117)}…` : insight.summary;
  return `${match.home.name} · ${preview}`;
}
