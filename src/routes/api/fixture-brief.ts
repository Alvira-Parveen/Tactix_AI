import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createAiGatewayProvider, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";
import { fetchFixtureById, normalizeFixture } from "@/lib/fixtures.server";
import type { MatchState } from "@/lib/match-data";
import { buildFixtureBriefPayload } from "@/lib/live-insights";

function buildFallbackBrief(match: MatchState) {
  return buildFixtureBriefPayload(match).brief;
}

// POST { fixtureId: "fd-537327" } -> { brief: string, match: MatchState }
export const Route = createFileRoute("/api/fixture-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        if (!active) return new Response("Missing API Key (GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)", { status: 500 });
        const { key } = active;

        let body: { fixtureId?: unknown };
        try {
          body = (await request.json()) as { fixtureId?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const raw = typeof body.fixtureId === "string" ? body.fixtureId : "";
        const numeric = Number(raw.replace(/^fd-/, ""));
        if (!Number.isFinite(numeric)) {
          return new Response("Invalid fixtureId", { status: 400 });
        }

        const fixture = await fetchFixtureById(numeric);
        if (!fixture) return new Response("Fixture not found", { status: 404 });

        const match = normalizeFixture(fixture, fixture.competition?.name ?? "");
        const fallbackPayload = buildFixtureBriefPayload(match);
        const fallbackBrief = fallbackPayload.brief;

        const prompt = `You are a football tactical analyst.
Match: ${match.home.name} vs ${match.away.name}
Competition: ${match.competition} — ${match.stage}
Status: ${match.status.toUpperCase()} · ${match.half}
Score: ${match.homeScore} – ${match.awayScore}
Kickoff: ${match.kickoff}

Write a concise 4-paragraph tactical brief (max 220 words total):
1. Team-strength context and recent form angle for both sides.
2. Likely tactical setup / expected formations for this fixture.
3. Key match-up or battle to watch.
4. What would decide it (only if not finished; if finished, summarize the tactical story).

Plain prose, no headings, no lists, no emojis, no hedging boilerplate.`;

        try {
          const gateway = createAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const { text } = await generateText({ model, prompt, maxRetries: 0 });
          const brief = text?.trim() ? text.trim() : fallbackBrief;
          return Response.json({ brief, match, summary: fallbackPayload.summary, keyMoments: fallbackPayload.keyMoments, tacticalNotes: fallbackPayload.tacticalNotes, nextActions: fallbackPayload.nextActions });
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI error";
          return Response.json({ brief: fallbackBrief, match, summary: fallbackPayload.summary, keyMoments: fallbackPayload.keyMoments, tacticalNotes: fallbackPayload.tacticalNotes, nextActions: fallbackPayload.nextActions, error: message }, { status: 200 });
        }
      },
    },
  },
});
