export type CoachAnalysis = {
  filename: string;
  formation: string;
  strengths: string[];
  weaknesses: string[];
  defensiveErrors: string[];
  attackingPatterns: string[];
  ratings: { player: string; score: number; reason: string }[];
  recommendation: string;
};

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-3"];
const STRENGTHS = [
  "Wide attacking transitions",
  "Vertical build-up through half-spaces",
  "High compact press in the middle third",
  "Coordinated back-line stepping",
];
const WEAKNESSES = [
  "Poor midfield compactness",
  "Slow rest-defense on turnovers",
  "Full-backs isolated in 1v1s",
  "Ball-side overloads leave far post exposed",
];
const RECOMMENDATIONS = [
  "Introduce a double pivot to improve defensive stability",
  "Push wide players to overload the weak side and switch",
  "Drop the block 10 metres and counter through the #10",
  "Rotate the pivot to protect the far center-back on switches",
];

function hashFilename(filename: string): number {
  return Array.from(filename).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
}

export function generateCoachAnalysis(filename: string): CoachAnalysis {
  const hash = hashFilename(filename);
  const pick = <T,>(values: T[]) => values[hash % values.length];
  const formation = pick(FORMATIONS);
  const strength = pick(STRENGTHS);
  const weakness = pick(WEAKNESSES);
  const rec = pick(RECOMMENDATIONS);

  return {
    filename,
    formation,
    strengths: [strength, "Coordinated pressing triggers on back-line touches"],
    weaknesses: [weakness, "Set-piece marking assignments break down after first contact"],
    defensiveErrors: [
      "62' — RB steps out of line, gap exploited",
      "78' — CBs split by a simple through ball on transition",
    ],
    attackingPatterns: [
      "Third-man combinations from CM → 10 → far winger",
      "Overlap + underlap pattern on the strong side",
    ],
    ratings: [
      { player: "#10 (playmaker)", score: 8.6, reason: "5 chances created, 92% pass accuracy, 0.71 xA" },
      { player: "#7 (winger)", score: 7.9, reason: "6 progressive carries, 3 shots on target" },
      { player: "#4 (CB)", score: 6.4, reason: "2 costly step-outs; 5/8 aerial duels" },
    ],
    recommendation: rec,
  };
}
