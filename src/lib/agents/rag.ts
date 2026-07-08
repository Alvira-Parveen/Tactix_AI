// ─── RAG Agent ────────────────────────────────────────────────────────────
// Retrieval over a small curated football/WC knowledge base. No vector DB —
// deterministic BM25-lite lexical scoring across a static corpus. Adding a
// pgvector-backed store later requires cloud hosting; the interface
// here is designed so the retrieve() function can be swapped out unchanged.

export type KnowledgeDoc = {
  id: string;
  title: string;
  tags: string[];
  body: string;
};

const CORPUS: KnowledgeDoc[] = [
  {
    id: "wc2026-format",
    title: "FIFA World Cup 2026 tournament format",
    tags: ["format", "wc2026", "history"],
    body: "The 2026 FIFA World Cup is the 23rd edition, hosted by USA, Canada and Mexico. It is the first World Cup with 48 teams, split into 12 groups of 4. The top two of each group plus the eight best third-placed sides advance to a 32-team Round of 16.",
  },
  {
    id: "wc-record-scorers",
    title: "All-time World Cup goalscorers",
    tags: ["records", "goalscoring", "history"],
    body: "Miroslav Klose (Germany) holds the all-time World Cup scoring record with 16 goals across 4 tournaments (2002-2014). Ronaldo Nazário (Brazil) has 15, Gerd Müller 14, Just Fontaine 13 in a single 1958 tournament.",
  },
  {
    id: "ppda-explainer",
    title: "PPDA — Passes per Defensive Action",
    tags: ["stat", "pressing", "metric"],
    body: "PPDA measures pressing intensity as the opponent's passes in their own build-up third divided by the pressing team's defensive actions in that zone. Lower is more intense. Elite pressing sides sit under 9; a mid-block averages 11-13.",
  },
  {
    id: "xg-explainer",
    title: "Expected Goals (xG) methodology",
    tags: ["stat", "xg", "metric"],
    body: "Expected Goals assigns each shot a probability of scoring (0-1) based on shot location, angle, body part, assist type, defensive pressure, and game state. Team xG per match >1.5 is above average; a top attacking side averages 2.0+ at World Cup level.",
  },
  {
    id: "formation-433",
    title: "4-3-3 tactical framework",
    tags: ["tactics", "formation"],
    body: "The 4-3-3 features a back four, a midfield three (usually one holding, two 8s) and a front three with two inverted wingers. Strengths: pressing triggers, positional attack, wide overloads. Weaknesses: exposed full-backs vs quick transitions, midfield triangle can be outnumbered by a 4-2-3-1.",
  },
  {
    id: "formation-3421",
    title: "3-4-2-1 tactical framework",
    tags: ["tactics", "formation"],
    body: "The 3-4-2-1 uses three centre-backs, two wing-backs, a midfield double pivot and two 10s behind a lone striker. It provides central overloads, protection for wing-backs, and easy back-three build-up. Weaknesses: pinned wing-backs, transition space between the centre-backs.",
  },
  {
    id: "counter-press",
    title: "Counter-pressing (Gegenpress)",
    tags: ["tactics", "pressing"],
    body: "Counter-pressing is the intense press applied immediately after losing possession, aiming to win the ball back within 5-6 seconds while the opponent is disorganised. Popularised by Jürgen Klopp; core metric: high turnovers per 90 and shots within 10 seconds of regain.",
  },
  {
    id: "wc-finals-history",
    title: "Recent World Cup finals",
    tags: ["history", "finals"],
    body: "2022: Argentina 3-3 France (Argentina 4-2 on penalties), Lusail. 2018: France 4-2 Croatia, Luzhniki. 2014: Germany 1-0 Argentina (AET), Maracanã. 2010: Spain 1-0 Netherlands (AET), Soccer City.",
  },
  {
    id: "team-brazil",
    title: "Brazil tactical profile 2026",
    tags: ["team", "brazil"],
    body: "Brazil under Dorival Júnior builds in a 4-3-3 rotating to a 3-2-5 in possession, with Vinícius Júnior pinning the touchline on the left and Rodrygo drifting inside. Weakness: high line vulnerable to direct running behind the centre-backs.",
  },
  {
    id: "team-spain",
    title: "Spain tactical profile 2026",
    tags: ["team", "spain"],
    body: "Spain under Luis de la Fuente run a possession-heavy 4-3-3 (58%+ average) with high positional discipline. Yamal on the right and Nico on the left provide isolation vs full-backs. PPDA averages 8.9 — most intense press in the R16 bracket.",
  },
  {
    id: "team-portugal",
    title: "Portugal tactical profile 2026",
    tags: ["team", "portugal"],
    body: "Portugal balance a possession game with counter-attacks through Leão and B. Silva. Set pieces are a major weapon: 3 of 6 tournament goals from dead balls, Ronaldo winning 62% of near-post corners.",
  },
  {
    id: "team-argentina",
    title: "Argentina tactical profile 2026",
    tags: ["team", "argentina"],
    body: "Argentina defend the World Cup as reigning champions. Scaloni uses a 4-4-2 base flexing to a 4-3-1-2 in possession with Messi in a free 10 role. Strength: elite counter-press led by Mac Allister and De Paul.",
  },
  {
    id: "team-france",
    title: "France tactical profile 2026",
    tags: ["team", "france"],
    body: "France under Deschamps run a 4-2-3-1 with Mbappé roaming from the left. Transition speed is elite: average recovery-to-shot time under 7 seconds. Vulnerability: right-back defending 1v1 vs pace.",
  },
  {
    id: "team-canada",
    title: "Canada tactical profile 2026",
    tags: ["team", "canada"],
    body: "Canada under Jesse Marsch builds in a dynamic 4-4-2 or 4-2-2-2, utilizing high pressing and rapid vertical transitions. Alphonso Davies drives the left flank while Jonathan David drops deep to link play. Weakness: vulnerability to counter-attacks behind high wing-backs.",
  },
  {
    id: "team-morocco",
    title: "Morocco tactical profile 2026",
    tags: ["team", "morocco"],
    body: "Morocco under Walid Regragui operates in a compact 4-3-3 low-to-mid block with exceptional defensive discipline. Sofyan Amrabat anchors the midfield, while Achraf Hakimi and Hakim Ziyech form a dangerous creative overload on the right flank. Strength: defensive solidity and quick transitions.",
  },
  {
    id: "team-norway",
    title: "Norway tactical profile 2026",
    tags: ["team", "norway"],
    body: "Norway under Ståle Solbakken plays a direct 4-3-3 focusing on feeding Erling Haaland in the box and utilizing Martin Ødegaard's elite creativity from the half-spaces. Wingers cut inside to overload the central areas. Weakness: defensive transitions when Ødegaard is closed down.",
  },
  {
    id: "team-egypt",
    title: "Egypt tactical profile 2026",
    tags: ["team", "egypt"],
    body: "Egypt operates in a counter-attacking 4-3-3 utilizing Mohamed Salah's pace on the right wing. They employ a disciplined mid-block to limit spaces centrally and rely on long diagonal passes to release wingers. Strength: clinical execution in transitions.",
  },
  {
    id: "momentum-metric",
    title: "Momentum modelling in football",
    tags: ["stat", "momentum", "metric"],
    body: "Momentum is typically modelled as a rolling weighted sum of shot xG, dangerous entries, and possession in the final third, normalised to [-1, 1]. A swing of 0.5+ across two windows is statistically significant and often precedes a goal within 8 minutes.",
  },
];

const STOPWORDS = new Set([
  "the","a","an","and","or","of","in","on","for","to","by","with","is","are","was","were","be","been","this","that","it","as","at","from","how","what","why","when","which","who","do","does","did","'s"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function score(doc: KnowledgeDoc, qTokens: string[]): number {
  const text = `${doc.title} ${doc.tags.join(" ")} ${doc.body}`.toLowerCase();
  const docTokens = tokenize(text);
  const dl = docTokens.length || 1;
  const tf: Record<string, number> = {};
  for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;

  let s = 0;
  for (const q of qTokens) {
    const f = tf[q] || 0;
    if (f === 0) continue;
    // BM25-lite: k1=1.5, b=0.75, no IDF weighting (small corpus).
    s += (f * (1.5 + 1)) / (f + 1.5 * (1 - 0.75 + 0.75 * (dl / 80)));
    // Title boost.
    if (doc.title.toLowerCase().includes(q)) s += 1.2;
    // Tag boost.
    if (doc.tags.some((tag) => tag.includes(q))) s += 0.8;
  }
  return s;
}

export type Retrieval = {
  query: string;
  hits: Array<{ id: string; title: string; score: number; snippet: string }>;
};

export function retrieve(query: string, k = 3): Retrieval {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return { query, hits: [] };
  const ranked = CORPUS
    .map((doc) => ({ doc, s: score(doc, qTokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ doc, s }) => ({
      id: doc.id,
      title: doc.title,
      score: +s.toFixed(2),
      snippet: doc.body,
    }));
  return { query, hits: ranked };
}

export function corpusStats() {
  return { docs: CORPUS.length, tags: Array.from(new Set(CORPUS.flatMap((d) => d.tags))).sort() };
}
