import type { Insight, MatchState, StatBlock, WinProbability } from "./match-data";

export type TacticalInsightInput = {
  match: MatchState;
  stats?: StatBlock[];
  winProbability?: WinProbability;
  options?: {
    isLive?: boolean;
  };
};

function pick<T>(values: T[], index: number): T {
  return values[index % values.length];
}

export function buildConversationPrompts(
  match: MatchState,
  stats: StatBlock[] = [],
  winProbability?: WinProbability,
) {
  const possession = stats.find((s) => s.label.toLowerCase().includes("possession"));
  const homePct = possession?.homePct ?? 50;
  const homeName = match.home.name;
  const awayName = match.away.name;
  const status = match.status === "live" ? "live" : match.status === "upcoming" ? "upcoming" : "finished";

  const seedChat = [
    {
      id: "context-1",
      role: "assistant" as const,
      text: `Current state: ${homeName} vs ${awayName} is ${status}. The match is ${match.status === "live" ? `in the ${match.half.toLowerCase()} at ${match.minute}'` : match.status === "upcoming" ? "pre-match" : "finished"}. I can explain the structure, pressing pattern, and next tactical change.`,
    },
  ];

  const suggestedQuestions = [
    `How is ${homeName} shaping the game tactically right now?`,
    `What is ${awayName} doing to press or counter?`,
    `Which tactical shift would most likely change the balance of this match?`,
    homePct >= 55 ? `Why is ${homeName} controlling possession and where is the weak link?` : `How can ${homeName} break through ${awayName}'s structure?`,
  ];

  if (winProbability) {
    suggestedQuestions.push(`What does the ${winProbability.home}% vs ${winProbability.away}% probability picture suggest about the next phase?`);
  }

  return { seedChat, suggestedQuestions };
}

export function buildTacticalInsights(
  match: MatchState,
  stats: StatBlock[] = [],
  winProbability?: WinProbability,
  options: { isLive?: boolean } = {},
): Insight[] {
  const possession = stats.find((s) => s.label.toLowerCase().includes("possession"));
  const xg = stats.find((s) => s.label.toLowerCase().includes("xg"));
  const homePct = possession?.homePct ?? 50;
  const isLive = options.isLive ?? match.status === "live";

  const homeName = match.home.name;
  const awayName = match.away.name;
  const lead = match.homeScore > match.awayScore ? "home" : match.homeScore < match.awayScore ? "away" : "draw";

  const base: Insight[] = [];

  if (match.status === "upcoming") {
    const shape = homePct >= 55 ? "shape the game through controlled possession" : "look to counter with direct transitions";
    const press = homePct >= 55 ? "press high and force turnovers in the middle third" : "protect the build-up and attack the spaces behind the first line";
    base.push({
      id: "pre-1",
      kind: "insight",
      label: "PRE-MATCH PLAN",
      minute: "—",
      body: `${homeName} are likely to ${shape}. The key tactical question is whether ${awayName} can ${press} when the ball is turned over.`,
    });
    base.push({
      id: "pre-2",
      kind: "alert",
      label: "MATCH-UP WATCH",
      minute: "—",
      body: `If ${awayName} can win the first 10 minutes of duels, they can trigger fast transitions and attack the wide channels before the structure settles.`,
    });
  } else if (isLive) {
    const liveLabel = lead === "home"
      ? `${homeName} are protecting a lead and should stay compact in the middle third`
      : lead === "away"
        ? `${awayName} are chasing and should increase verticality through the half-spaces`
        : "The match is balanced and the next phase is likely to decide the pattern";

    const transitionAdvice = xg && Number.parseFloat(xg.home) > Number.parseFloat(xg.away) ? "keep the ball moving through the wide overloads" : "attack the spaces behind the first line";

    base.push({
      id: "live-1",
      kind: "insight",
      label: "LIVE TACTICAL STATE",
      minute: `${match.minute}'`,
      body: `${liveLabel}. The current structure suggests ${transitionAdvice} rather than forcing low-value possession.`,
    });

    base.push({
      id: "live-2",
      kind: "danger",
      label: "TRANSITION RISK",
      minute: `${match.minute}'`,
      body: `A single turnover here can swing the game quickly, especially if the full-back steps high and leaves the inside channel exposed.`,
    });
  } else {
    const finalState = match.homeScore > match.awayScore ? `${homeName} controlled the game through structure and tempo` : match.homeScore < match.awayScore ? `${awayName} controlled the game through structure and tempo` : "The match was decided by small margins and timing rather than territory";
    base.push({
      id: "post-1",
      kind: "insight",
      label: "MATCH SUMMARY",
      minute: "FT",
      body: `${finalState}. The final phase of the match shows how the game was won and where the balance shifted.`,
    });
    base.push({
      id: "post-2",
      kind: "alert",
      label: "KEY LESSON",
      minute: "FT",
      body: `The side that stayed more compact in the defensive phase created the cleaner chances once the match opened up.`,
    });
  }

  const probabilityInsight = winProbability ? {
    id: "prob-1",
    kind: "alert" as const,
    label: "WIN PROBABILITY",
    minute: `${match.minute}'`,
    body: `${homeName} are at ${winProbability.home}% to win, ${awayName} at ${winProbability.away}% and a draw at ${winProbability.draw}%. The next action could shift that balance quickly.`,
  } : null;

  const dynamic: Insight[] = [];
  if (probabilityInsight) dynamic.push(probabilityInsight);
  if (match.status !== "upcoming") {
    dynamic.push({
      id: "dyn-1",
      kind: "insight",
      label: "PHASE SHIFT",
      minute: `${match.minute}'`,
      body: `The balance has moved ${pick(["from controlled build-up into transition play", "from midfield dominance into direct attacks", "from pressing into recovery shape"], match.minute)}`,
    });
  }

  return [...base, ...dynamic].slice(0, 5);
}
