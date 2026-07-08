import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createAiGatewayProvider, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";
import { getMatchDataset } from "@/lib/match-data";
import { detectDangerousAttacks, tacticalReport } from "@/lib/agents/tactical";

// Streaming AI match commentary. The client POSTs { matchId } and receives
// a plain-text stream of broadcaster-style commentary lines derived from the
// match's shots, insights, and detected dangerous attacks. One request per
// generation; the model reads the pre-computed event list and narrates it.

function getMockCommentary(matchId: string): string {
  if (matchId.includes("bra-nor")) {
    return `0' — Kickoff! Brazil vs Norway is underway in this Round of 16 clash.\n` +
           `12' — DANGER! Nusa breaks down the wing, whipping a cross to Haaland whose header is blocked by Gabriel!\n` +
           `24' — TACTICAL: Norway holding 65% possession, playing slow build-up, while Brazil sits compact in a 4-4-2 block.\n` +
           `35' — CHANCE! Vinícius Jr. bursts past Ryerson and shoots from a tight angle, but Nyland deflects it out.\n` +
           `45' — Halftime! The referee blows the whistle. A fascinating tactical battle, locked at 0-0.`;
  }
  return `0' — Kickoff! The match is underway.\n` +
         `45' — Halftime. Both sides looking for a breakthrough.\n` +
         `90' — Fulltime. The referee blows the final whistle.`;
}

export const Route = createFileRoute("/api/commentary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        let body: { matchId?: unknown };
        try {
          body = (await request.json()) as { matchId?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const matchId = typeof body.matchId === "string" ? body.matchId : "";
        const dataset = getMatchDataset(matchId);
        if (!dataset) return new Response("Unknown matchId", { status: 404 });

        const tactical = tacticalReport(dataset);
        const dangers = detectDangerousAttacks(dataset);
        const { match, shots, insights } = dataset;

        const events = [
          ...shots.map((s) => ({
            minute: s.minute,
            kind: s.outcome === "goal" ? "goal" : s.outcome === "on-target" ? "shot-on" : s.outcome === "blocked" ? "block" : "shot-off",
            team: s.team === "home" ? match.home.name : match.away.name,
            player: s.player,
            xG: s.xG,
            zone: s.y < 33 ? "left" : s.y > 66 ? "right" : "central",
          })),
          ...insights.map((i) => ({
            minute: Number((i.minute.match(/\d+/) ?? ["0"])[0]),
            kind: i.kind,
            note: `${i.label}: ${i.body}`,
          })),
          ...dangers.map((d) => ({
            minute: d.minute,
            kind: `danger-${d.intensity}`,
            team: d.teamName,
            note: d.headline,
          })),
        ].sort((a, b) => a.minute - b.minute);

        const context = {
          match: `${match.home.name} ${match.homeScore}-${match.awayScore} ${match.away.name} (${match.stage})`,
          minute: match.minute,
          press: tactical.press,
          territory: tactical.territory,
          momentum: tactical.momentumPhase,
          attackChannel: tactical.attackChannel,
          events,
        };

        const system = `You are TACTIX AI, a professional football commentator. You will receive a JSON snapshot of a match's key events and tactical context. Produce short, broadcaster-style commentary lines in chronological order.

RULES:
- One line per event, prefixed with the minute in the form "38' — ".
- Use present tense. Reference the tactical context (press, territory, channels) where it adds meaning.
- For "goal" events: exclaim and mention the xG.
- For "danger-*" events: flag the dangerous sequence with urgency.
- For "shot-on" or "block": explain the buildup or defensive reaction briefly.
- Do NOT invent players, scores, or minutes. Only narrate the events provided.
- Do NOT wrap the output in JSON or code fences. Plain text lines, one per line.
- Aim for 12-18 lines total. Skip trivial "shot-off" events unless they're part of a bigger phase.`;

        const encoder = new TextEncoder();

        if (!active) {
          const stream = new ReadableStream({
            async start(controller) {
              const fallback = getMockCommentary(matchId);
              for (const char of fallback) {
                controller.enqueue(encoder.encode(char));
                await new Promise((r) => setTimeout(r, 10));
              }
              controller.close();
            }
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        }
        const { key } = active;

        try {
          const gateway = createAiGatewayProvider(key);
          const result = streamText({
            model: gateway("google/gemini-3-flash-preview"),
            system,
            prompt: `Match context:\n${JSON.stringify(context, null, 2)}\n\nGenerate the commentary now.`,
            maxRetries: 0,
          });

          // Catch promise rejections to avoid unhandled promise warning/aborts
          result.text.catch(() => {});
          result.toolCalls.catch(() => {});
          result.toolResults.catch(() => {});

          const stream = new ReadableStream({
            async start(controller) {
              let receivedChunks = false;
              try {
                for await (const delta of result.textStream) {
                  if (delta) {
                    receivedChunks = true;
                    controller.enqueue(encoder.encode(delta));
                  }
                }
                if (!receivedChunks) {
                  console.warn("AI Commentary empty, returning mock.");
                  const fallback = getMockCommentary(matchId);
                  for (const char of fallback) {
                    controller.enqueue(encoder.encode(char));
                    await new Promise((r) => setTimeout(r, 10));
                  }
                }
                controller.close();
              } catch (err) {
                console.warn("AI Commentary failed, returning mock:", err);
                const fallback = getMockCommentary(matchId);
                for (const char of fallback) {
                  controller.enqueue(encoder.encode(char));
                  await new Promise((r) => setTimeout(r, 10));
                }
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (err) {
          console.warn("AI Commentary failed to start, returning mock:", err);
          const stream = new ReadableStream({
            async start(controller) {
              const fallback = getMockCommentary(matchId);
              for (const char of fallback) {
                controller.enqueue(encoder.encode(char));
                await new Promise((r) => setTimeout(r, 10));
              }
              controller.close();
            }
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        }
      },
    },
  },
});
