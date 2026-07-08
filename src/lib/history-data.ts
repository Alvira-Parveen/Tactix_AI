// Historical intelligence: cross-era, cross-team dream matchups between
// iconic tournament sides. Static/mocked but shaped to feel like a real
// analytics database.

export type EraStat = {
  label: string;
  a: number; // era A value
  b: number; // era B value
  unit?: string;
  higherIsBetter?: boolean;
  hint?: string;
};

export type Era = {
  id: string;
  team: string;
  year: number;
  manager: string;
  formation: string;
  style: string; // one-liner tactical identity
  achievements: string[];
  keyPlayers: string[];
};

export type HistoricalMatchup = {
  id: string;
  title: string;
  summary: string;
  a: Era;
  b: Era;
  stats: EraStat[];
  verdict: string;
};

export const HISTORICAL_MATCHUPS: HistoricalMatchup[] = [
  {
    id: "bra2002-vs-esp2010",
    title: "Brazil 2002 vs Spain 2010",
    summary:
      "Maximalist samba attack vs tiki-taka's world-champion original. Rivaldo/Ronaldo/Ronaldinho against Xavi/Iniesta/Villa in a hypothetical prime-vs-prime final.",
    a: {
      id: "bra-2002",
      team: "Brazil",
      year: 2002,
      manager: "Luiz Felipe Scolari",
      formation: "3-4-1-2",
      style: "Free-flowing attack, Cafu/Roberto Carlos overlaps, direct verticals",
      achievements: ["World Cup 2002 winner"],
      keyPlayers: ["Ronaldo", "Rivaldo", "Ronaldinho", "Cafu", "Roberto Carlos"],
    },
    b: {
      id: "esp-2010",
      team: "Spain",
      year: 2010,
      manager: "Vicente del Bosque",
      formation: "4-2-3-1",
      style: "Slow-build tiki-taka, midfield suffocation via Xavi/Iniesta",
      achievements: ["World Cup 2010 winner"],
      keyPlayers: ["Xavi", "Iniesta", "Villa", "Busquets", "Puyol"],
    },
    stats: [
      { label: "Avg possession", a: 54, b: 66, unit: "%", higherIsBetter: true },
      { label: "Pass accuracy", a: 82, b: 89, unit: "%", higherIsBetter: true },
      { label: "PPDA (press intensity)", a: 14.6, b: 11.4, higherIsBetter: false, hint: "Lower = more aggressive press." },
      { label: "xG per 90", a: 1.9, b: 1.35, higherIsBetter: true },
      { label: "Shots on target / 90", a: 6.4, b: 4.1, higherIsBetter: true },
      { label: "1v1 dribbles won / 90", a: 12, b: 7, higherIsBetter: true },
      { label: "Goals conceded / 90", a: 0.42, b: 0.29, higherIsBetter: false },
    ],
    verdict:
      "Brazil generates more raw xG through individual brilliance; Spain strangles the game with the ball. Model gives Spain a slight edge on tempo control — but a single Ronaldo moment tilts it.",
  },
  {
    id: "ger2014-vs-fra2018",
    title: "Germany 2014 vs France 2018",
    summary:
      "Löw's positional champions against Deschamps' counter-punching Mbappé side. Control vs transitions in the modern era's cleanest tactical clash.",
    a: {
      id: "ger-2014",
      team: "Germany",
      year: 2014,
      manager: "Joachim Löw",
      formation: "4-2-3-1",
      style: "Positional build, Kroos/Schweinsteiger midfield control",
      achievements: ["World Cup 2014 winner"],
      keyPlayers: ["Kroos", "Schweinsteiger", "Müller", "Neuer", "Lahm"],
    },
    b: {
      id: "fra-2018",
      team: "France",
      year: 2018,
      manager: "Didier Deschamps",
      formation: "4-2-3-1",
      style: "Compact block, Kanté screen, Mbappé/Griezmann in transition",
      achievements: ["World Cup 2018 winner"],
      keyPlayers: ["Mbappé", "Griezmann", "Kanté", "Pogba", "Varane"],
    },
    stats: [
      { label: "Avg possession", a: 61, b: 48, unit: "%", higherIsBetter: true },
      { label: "Pass accuracy", a: 87, b: 83, unit: "%", higherIsBetter: true },
      { label: "PPDA (press intensity)", a: 10.1, b: 13.9, higherIsBetter: false },
      { label: "xG per 90", a: 1.6, b: 1.72, higherIsBetter: true },
      { label: "Transition goals / 90", a: 0.4, b: 1.1, higherIsBetter: true, hint: "France thrives on turnovers." },
      { label: "Progressive carries / 90", a: 24, b: 33, higherIsBetter: true },
      { label: "Goals conceded / 90", a: 0.38, b: 0.5, higherIsBetter: false },
    ],
    verdict:
      "Germany dominates the ball, but France's transition threat swings expected value. Model verdict: coin-flip, with France's ceiling higher whenever Mbappé gets a runway.",
  },
  {
    id: "arg2022-vs-esp2010",
    title: "Argentina 2022 vs Spain 2010",
    summary:
      "Messi's front-foot 4-3-3 vs Xavi-era ball retention. Two different flavours of midfield craft — one built around a single genius, one around a collective.",
    a: {
      id: "arg-2022",
      team: "Argentina",
      year: 2022,
      manager: "Lionel Scaloni",
      formation: "4-3-3",
      style: "Messi free-role, De Paul/Mac Allister energy, high press in bursts",
      achievements: ["World Cup 2022 winner", "Copa América 2021 winner"],
      keyPlayers: ["Messi", "Di María", "De Paul", "Mac Allister", "Martínez"],
    },
    b: {
      id: "esp-2010",
      team: "Spain",
      year: 2010,
      manager: "Vicente del Bosque",
      formation: "4-2-3-1",
      style: "Slow-build tiki-taka, midfield suffocation via Xavi/Iniesta",
      achievements: ["World Cup 2010 winner"],
      keyPlayers: ["Xavi", "Iniesta", "Villa", "Busquets", "Puyol"],
    },
    stats: [
      { label: "Avg possession", a: 56, b: 66, unit: "%", higherIsBetter: true },
      { label: "Pass accuracy", a: 85, b: 89, unit: "%", higherIsBetter: true },
      { label: "PPDA (press intensity)", a: 9.4, b: 11.4, higherIsBetter: false },
      { label: "xG per 90", a: 1.68, b: 1.35, higherIsBetter: true },
      { label: "Chances created / 90", a: 13, b: 11, higherIsBetter: true },
      { label: "Progressive passes / 90", a: 48, b: 42, higherIsBetter: true },
      { label: "Goals conceded / 90", a: 0.6, b: 0.29, higherIsBetter: false },
    ],
    verdict:
      "Spain wins the possession chess match; Argentina wins the moments. Messi generates enough non-shot xG to break even the most disciplined block — the model gives Argentina the narrow edge.",
  },
  {
    id: "fra1998-vs-ita2006",
    title: "France 1998 vs Italy 2006",
    summary:
      "Zidane-Deschamps midfield mastery vs Lippi's catenaccio-with-craft. Two champions separated by eight years, both winners of a home-continent World Cup final.",
    a: {
      id: "fra-1998",
      team: "France",
      year: 1998,
      manager: "Aimé Jacquet",
      formation: "4-3-2-1",
      style: "Zidane in the hole, Deschamps/Petit shield, wing-back thrust",
      achievements: ["World Cup 1998 winner"],
      keyPlayers: ["Zidane", "Deschamps", "Thuram", "Blanc", "Henry"],
    },
    b: {
      id: "ita-2006",
      team: "Italy",
      year: 2006,
      manager: "Marcello Lippi",
      formation: "4-4-1-1",
      style: "Compact defensive block, Pirlo tempo, Totti free-role in behind",
      achievements: ["World Cup 2006 winner"],
      keyPlayers: ["Pirlo", "Cannavaro", "Totti", "Buffon", "Materazzi"],
    },
    stats: [
      { label: "Avg possession", a: 55, b: 52, unit: "%", higherIsBetter: true },
      { label: "Pass accuracy", a: 84, b: 86, unit: "%", higherIsBetter: true },
      { label: "PPDA (press intensity)", a: 13.2, b: 15.8, higherIsBetter: false },
      { label: "xG per 90", a: 1.4, b: 1.25, higherIsBetter: true },
      { label: "Set-piece xG / 90", a: 0.28, b: 0.42, higherIsBetter: true, hint: "Italy's dead-ball edge is huge." },
      { label: "Defensive duels won %", a: 62, b: 68, unit: "%", higherIsBetter: true },
      { label: "Goals conceded / 90", a: 0.28, b: 0.23, higherIsBetter: false },
    ],
    verdict:
      "Two of the meanest defences ever. Model calls it near-even with Italy edging via set pieces — but any Zidane moment on the ball rewrites the projection.",
  },
];

export function getMatchup(id: string): HistoricalMatchup | undefined {
  return HISTORICAL_MATCHUPS.find((m) => m.id === id);
}

// ─── Player-level cross-era comparisons ───────────────────────────────────

export type PlayerEra = {
  id: string;
  name: string;
  team: string;
  year: number;
  role: string;
  style: string;
  achievements: string[];
};

export type PlayerMatchup = {
  id: string;
  title: string;
  summary: string;
  a: PlayerEra;
  b: PlayerEra;
  stats: EraStat[];
  verdict: string;
};

export const PLAYER_MATCHUPS: PlayerMatchup[] = [
  {
    id: "xavi2010-vs-pedri2024",
    title: "Xavi 2010 vs Pedri 2024",
    summary: "Two La Masia metronomes. Xavi's Barcelona-era tempo control against Pedri's press-resistant, more vertical evolution.",
    a: { id: "xavi-2010", name: "Xavi Hernández", team: "Spain", year: 2010, role: "Deep-lying playmaker", style: "Tempo control, positional third-man passes, receive-and-turn under pressure", achievements: ["World Cup 2010", "Euro 2008/2012", "Ballon d'Or 3rd (2010, 2011)"] },
    b: { id: "pedri-2024", name: "Pedri González", team: "Spain", year: 2024, role: "Half-space 8", style: "Press-resistant carries, half-turn combinations, arrives late in the box", achievements: ["Euro 2024 winner", "Kopa Trophy 2021"] },
    stats: [
      { label: "Pass accuracy", a: 91, b: 89, unit: "%", higherIsBetter: true },
      { label: "Progressive passes / 90", a: 9.4, b: 7.8, higherIsBetter: true },
      { label: "Progressive carries / 90", a: 2.1, b: 4.6, higherIsBetter: true },
      { label: "Chances created / 90", a: 2.1, b: 2.4, higherIsBetter: true },
      { label: "xA / 90", a: 0.24, b: 0.31, higherIsBetter: true },
      { label: "Dispossessed / 90", a: 1.1, b: 0.9, higherIsBetter: false },
      { label: "Duels won %", a: 52, b: 58, unit: "%", higherIsBetter: true },
    ],
    verdict: "Xavi still wins on pure passing volume and control; Pedri edges it on progression through carries and higher chance creation. Different eras, same brain.",
  },
  {
    id: "zidane2000-vs-modric2018",
    title: "Zidane 2000 vs Modrić 2018",
    summary: "Peak-Zidane elegance versus prime-Modrić stamina and vision. Both dragged smaller squads to a World Cup final.",
    a: { id: "zidane-2000", name: "Zinedine Zidane", team: "France", year: 2000, role: "Attacking midfielder", style: "First-touch magic, spin-away press escape, long diagonals to the striker", achievements: ["Euro 2000", "World Cup 1998", "Ballon d'Or 1998"] },
    b: { id: "modric-2018", name: "Luka Modrić", team: "Croatia", year: 2018, role: "Complete midfielder", style: "Endless press-resistance, ball-carrying, diagonal switches from deep", achievements: ["World Cup 2018 finalist", "Ballon d'Or 2018"] },
    stats: [
      { label: "Pass accuracy", a: 84, b: 88, unit: "%", higherIsBetter: true },
      { label: "Progressive passes / 90", a: 6.8, b: 8.5, higherIsBetter: true },
      { label: "Progressive carries / 90", a: 4.8, b: 5.6, higherIsBetter: true },
      { label: "Chances created / 90", a: 3.1, b: 2.6, higherIsBetter: true },
      { label: "xA / 90", a: 0.32, b: 0.28, higherIsBetter: true },
      { label: "Distance covered (km) / 90", a: 10.4, b: 12.1, higherIsBetter: true },
      { label: "Successful dribbles / 90", a: 3.6, b: 2.1, higherIsBetter: true },
    ],
    verdict: "Zidane's ceiling on any single action is untouchable; Modrić's engine and progression volume win the marathon.",
  },
  {
    id: "ronaldo2002-vs-mbappe2022",
    title: "R9 2002 vs Mbappé 2022",
    summary: "The clinical Brazilian phenom versus the modern speed-freak striker. Two of the most feared forwards in World Cup finals history.",
    a: { id: "r9-2002", name: "Ronaldo Nazário", team: "Brazil", year: 2002, role: "Centre-forward", style: "Ruthless finishing, sharp cuts inside the box, back-to-goal hold-up", achievements: ["World Cup 2002 Golden Boot (8)", "Ballon d'Or 2002"] },
    b: { id: "mbappe-2022", name: "Kylian Mbappé", team: "France", year: 2022, role: "Left-wing forward", style: "Vertical acceleration, cut-inside finishing, transition threat", achievements: ["World Cup 2022 Golden Boot (8)", "World Cup 2018 winner"] },
    stats: [
      { label: "Non-penalty goals / 90", a: 1.05, b: 0.86, higherIsBetter: true },
      { label: "xG / 90", a: 0.82, b: 0.68, higherIsBetter: true },
      { label: "Shots / 90", a: 4.1, b: 5.2, higherIsBetter: true },
      { label: "Shot conversion %", a: 26, b: 18, unit: "%", higherIsBetter: true },
      { label: "Successful dribbles / 90", a: 3.4, b: 4.2, higherIsBetter: true },
      { label: "Sprint distance (km) / 90", a: 1.9, b: 2.6, higherIsBetter: true },
      { label: "Aerial duels won %", a: 46, b: 32, unit: "%", higherIsBetter: true },
    ],
    verdict: "R9 was purer inside the box; Mbappé generates from further out and in transition. Same Golden Boot count, different scoring routes.",
  },
  {
    id: "beckenbauer1974-vs-vandijk2022",
    title: "Beckenbauer 1974 vs Van Dijk 2022",
    summary: "The libero who invented modern build-up versus the modern positional-defence archetype. Two eras of ball-playing centre-backs.",
    a: { id: "kb-1974", name: "Franz Beckenbauer", team: "West Germany", year: 1974, role: "Libero / Sweeper", style: "Step-out from the back, midfield line-breaks, orchestrated build-up", achievements: ["World Cup 1974", "Euro 1972", "Ballon d'Or 1972, 1976"] },
    b: { id: "vvd-2022", name: "Virgil van Dijk", team: "Netherlands", year: 2022, role: "Positional centre-back", style: "High defensive line, angled diagonals, dominant aerial duels", achievements: ["Nations League final 2019", "Premier League 2020"] },
    stats: [
      { label: "Pass accuracy", a: 86, b: 91, unit: "%", higherIsBetter: true },
      { label: "Progressive passes / 90", a: 9.2, b: 7.1, higherIsBetter: true },
      { label: "Progressive carries / 90", a: 3.4, b: 1.6, higherIsBetter: true },
      { label: "Aerial duels won %", a: 68, b: 74, unit: "%", higherIsBetter: true },
      { label: "Tackles + interceptions / 90", a: 4.6, b: 3.9, higherIsBetter: true },
      { label: "Recoveries in opp. half / 90", a: 2.1, b: 3.4, higherIsBetter: true },
      { label: "Errors leading to shot / 90", a: 0.18, b: 0.06, higherIsBetter: false },
    ],
    verdict: "Beckenbauer is the more expressive on-ball defender — that role is nearly extinct. Van Dijk is the safer modern archetype with a higher defensive floor.",
  },
];

export function getPlayerMatchup(id: string): PlayerMatchup | undefined {
  return PLAYER_MATCHUPS.find((m) => m.id === id);
}
