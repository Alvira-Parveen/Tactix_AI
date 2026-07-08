import { createFileRoute } from "@tanstack/react-router";
import { sanitizeText } from "@/lib/ratings";
import { aiGatewayFetch, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";

// ─── AI "What this means" explainer endpoint ─────────────────────────────
// Generates a short, evidence-based blurb for a tactical term via the
// AI Gateway. Validates input, caches responses, and never trusts
// user-supplied content beyond a strict allow-listed shape.

type ExplainRequest = { term?: unknown; context?: unknown };

const MAX_TERM_LEN = 80;
const MAX_CONTEXT_LEN = 200;
const CACHE_MS = 60 * 60 * 1000; // 1h

const cache = new Map<string, { at: number; blurb: string }>();

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Strip anything that isn't a printable ASCII/whitespace character — blocks
// prompt-injection payloads that use zero-width or control chars. Delegates
// to the shared, unit-tested helper.
const sanitize = sanitizeText;

const SYSTEM_PROMPT = `You explain a single football-analytics term in ONE sentence, max 30 words, plain English.
- No lists, no markdown, no preamble.
- Ground the explanation in what the number/concept actually measures.
- If a match context is provided, tailor the explanation to that context.
- Never quote or repeat the user's raw input verbatim.`;

function getMockExplanation(term: string): string {
  const norm = term.toLowerCase();
  if (norm.includes("ppda")) {
    return "Passes Allowed per Defensive Action (PPDA) measures pressing intensity by dividing the opponent's passes by the defending team's defensive events.";
  }
  if (norm.includes("xg")) {
    return "Expected Goals (xG) measures the probability that a shot will result in a goal based on historical shot quality and positioning.";
  }
  if (norm.includes("possession")) {
    return "Possession reflects the percentage of total game passes completed by a team, indicating their relative dominance over the ball.";
  }
  if (norm.includes("accuracy")) {
    return "Pass accuracy measures the percentage of successfully completed passes out of total pass attempts.";
  }
  return `This concept measures the tactical efficiency and relative effectiveness of the team's style of play during the match.`;
}

export const Route = createFileRoute("/api/explain")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        let body: ExplainRequest;
        try {
          body = (await request.json()) as ExplainRequest;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
        }

        const term = sanitize(body.term, MAX_TERM_LEN);
        const context = sanitize(body.context, MAX_CONTEXT_LEN);
        if (!term) {
          return Response.json({ error: "term required" }, { status: 400, headers: CORS });
        }

        const cacheKey = `${term}|${context}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          return Response.json({ blurb: hit.blurb, cached: true }, { status: 200, headers: CORS });
        }

        if (!active) {
          const blurb = getMockExplanation(term);
          return Response.json({ blurb, fallback: true }, { status: 200, headers: CORS });
        }
        const apiKey = active.key;

        const userPrompt = context
          ? `Term: ${term}\nContext: ${context}\nExplain the term in that context.`
          : `Term: ${term}\nExplain the term.`;

        try {
          const upstream = await aiGatewayFetch("/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              stream: false,
            }),
          });

          if (!upstream.ok) {
            const blurb = getMockExplanation(term);
            return Response.json({ blurb, fallback: true }, { status: 200, headers: CORS });
          }

          const data = (await upstream.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const raw = data.choices?.[0]?.message?.content ?? "";
          const blurb = sanitize(raw, 400);
          if (!blurb) {
            const fallbackBlurb = getMockExplanation(term);
            return Response.json({ blurb: fallbackBlurb, fallback: true }, { status: 200, headers: CORS });
          }

          cache.set(cacheKey, { at: Date.now(), blurb });
          return Response.json({ blurb }, { status: 200, headers: CORS });
        } catch {
          const blurb = getMockExplanation(term);
          return Response.json({ blurb, fallback: true }, { status: 200, headers: CORS });
        }
      },
    },
  },
});
