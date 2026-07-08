// ─── Shared, pure helpers (unit-tested) ──────────────────────────────────

/**
 * Strip control characters and clamp length. Used to sanitize any text
 * the server sends into an LLM prompt or logs — blocks prompt-injection
 * payloads that rely on zero-width or control chars.
 */
export function sanitizeText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export type PlayerRatingInput = {
  shots: number;
  sot: number;
  goals: number;
  xG: number;
  xGDelta: number;
};

/**
 * Evidence-based player rating. Anchored at 6.5, adjusted by goals, xG
 * involvement, finishing vs expected, and shot accuracy. Clamped 4.0–9.9.
 * Returns the numeric metric reasons so the UI can render explanations.
 */
export function ratePlayer(row: PlayerRatingInput): {
  rating: number;
  metricReasons: string[];
} {
  const reasons: string[] = [];
  let score = 6.5;

  if (row.goals > 0) {
    score += row.goals * 1.4;
    reasons.push(`+${(row.goals * 1.4).toFixed(1)} from ${row.goals} goal${row.goals > 1 ? "s" : ""}`);
  }

  if (row.xG >= 0.4) {
    score += 0.6;
    reasons.push(`+0.6 for high-xG involvement (${row.xG.toFixed(2)} xG)`);
  } else if (row.xG >= 0.2) {
    score += 0.3;
    reasons.push(`+0.3 for chance creation (${row.xG.toFixed(2)} xG)`);
  }

  if (row.xGDelta >= 0.25) {
    score += 0.4;
    reasons.push(`+0.4 for overperforming xG by ${row.xGDelta.toFixed(2)}`);
  } else if (row.xGDelta <= -0.2 && row.shots >= 2) {
    score -= 0.3;
    reasons.push(`−0.3 for underperforming xG by ${Math.abs(row.xGDelta).toFixed(2)}`);
  }

  if (row.shots >= 2) {
    const sotRate = row.sot / row.shots;
    if (sotRate >= 0.5) {
      score += 0.2;
      reasons.push(`+0.2 for ${row.sot}/${row.shots} shots on target`);
    } else if (sotRate === 0 && row.goals === 0) {
      score -= 0.2;
      reasons.push(`−0.2 for 0/${row.shots} shots on target`);
    }
  }

  score = Math.max(4.0, Math.min(9.9, score));
  return { rating: Math.round(score * 10) / 10, metricReasons: reasons };
}
