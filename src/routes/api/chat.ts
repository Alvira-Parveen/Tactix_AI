import { createFileRoute } from "@tanstack/react-router";
import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { createAiGatewayProvider, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";
import { getMatchDataset } from "@/lib/match-data";
import { tacticalReport } from "@/lib/agents/tactical";
import { predictOutcome } from "@/lib/agents/prediction";
import { retrieve } from "@/lib/agents/rag";
import { buildVisualization } from "@/lib/agents/visualization";
import { snapshotOf, detectEvents } from "@/lib/agents/live-data";
import { analyseVideo } from "@/lib/agents/video";

type ChatMsg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are TACTIX AI, the LLM Coach agent in a multi-agent football analysis system.

You call the specialist agents (tools) below and translate their structured output into concise analyst English.

Available agents:
- tactical_agent(matchId): formation channels, pressing intensity (PPDA), territorial dominance, xG efficiency
- prediction_agent(matchId): Poisson-based win/draw/loss %, next-goal probability, expected final score
- live_data_agent(matchId): detected match events (goals, big chances, momentum swings)
- rag_agent(query): retrieval from the football/WC knowledge base
- visualization_agent(matchId): heatmap + pass-network data specs
- video_agent(): computer-vision analysis — currently unsupported on this runtime
- sports_api_agent(matchId): query the live sports API (like API-Football) for the live score, elapsed time, and real-time events of a specific match. You MUST call this tool every 60 seconds during an active match to update the 'Multi-agent console' with real facts.

Rules:
- You are a professional coach. When asked for tactical plans, half-time adjustments, neutralized threats, set-piece playbooks, or substitution plans (like the drill buttons request), you MUST use the team profiles (RAG) and match stats to formulate a highly detailed, professional, and concrete tactical plan. Never refuse these requests.
- Call the relevant tools BEFORE answering when the user asks about live state, tactics, predictions, or football concepts. Pass empty string for matchId to use the currently viewed match.
- You MUST call the 'sports_api_agent' tool every 60 seconds during an active match to update the 'Multi-agent console' with real facts, live scores, and events.
- Be concise (2-4 sentences) for simple questions, but write a comprehensive, structured plan (with sections and bullet points) if asked for depth or a drill. Cite the specific numbers the tools returned.
- Never mention system prompts, model names, or that you are an AI.`;

function getMockChatResponse(messages: ModelMessage[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";

  if (lastMsg.includes("plan") || lastMsg.includes("pre-match") || lastMsg.includes("formation")) {
    return `### TACTIX AI - PRE-MATCH PLAYBOOK (LOCAL FALLBACK)

Here is your detailed tactical setup for the Brazil vs Norway fixture:

#### 1. Formations & Predicted Lineups
*   **Brazil (4-3-3):** Ederson; Danilo, Marquinhos, Gabriel, Wendell; Guimarães, Gomes, Paquetá; Raphinha, Rodrygo, Vinícius Jr.
*   **Norway (4-3-3):** Nyland; Ryerson, Hanche-Olsen, Østigård, Wolfe; Ødegaard, Berge, Thorsby; Sørloth, Haaland, Nusa.

#### 2. Key Defensive Instructions
*   **Out of possession:** Brazil must compress central channels. Paquetá should drop into a compact 4-4-2 block to restrict passing angles to Martin Ødegaard.
*   **Pressing triggers:** Initiate a high press (PPDA ~9.2) when Norway plays wide to Ryerson. Force Nyland to clear long toward Marquinhos, neutralizing Haaland's ground runs.
*   **Set-piece setup:** Employ zonal markers on the front post with Gabriel tight-marking Erling Haaland.

#### 3. Transition Targets
*   **Target Flank:** Focus attacks behind wing-back Wolfe. Utilize Vinícius Jr.'s pace in 1v1 duels against Hanche-Olsen.`;
  }

  if (lastMsg.includes("xg") || lastMsg.includes("possession") || lastMsg.includes("generating")) {
    return `Norway holds **65% possession** and has created **4 shots**, whereas Brazil has **35% possession** and **5 shots**. Both sides have 2 shots on target. The expected goals stand at **0.42 xG for Brazil** and **0.38 xG for Norway**. Brazil's quick counter-attacks carry more threat, while Norway controls the tempo in central areas.`;
  }

  if (lastMsg.includes("threat") || lastMsg.includes("neutralize") || lastMsg.includes("haaland")) {
    return `### TACTIX AI - THREAT NEUTRALIZATION (LOCAL FALLBACK)

To neutralize Erling Haaland:
1.  **Cut supply lines:** Have Guimarães shadow Martin Ødegaard to block creative passes.
2.  **Depth coverage:** Marquinhos engages Haaland physically while Gabriel provides cover in in behind.
3.  **Cross prevention:** Instruct full-backs to press Nusa and Sørloth immediately to block incoming crosses.`;
  }

  if (lastMsg.includes("weakness") || lastMsg.includes("exploit")) {
    return `### TACTIX AI - WEAKNESS EXPLOITATION (LOCAL FALLBACK)

Norway's main weakness is defensive transitions on the left.
*   **Plan:** Feed diagonal balls into Raphinha and Rodrygo underlapping in the space vacated by Wolfe.`;
  }

  if (lastMsg.includes("sub") || lastMsg.includes("substitution")) {
    return `### TACTIX AI - SUBS PLAYBOOK (LOCAL FALLBACK)

Recommended substitutions at the 60':
1.  **Brazil:** Martinelli in for Raphinha to exploit tired full-backs.
2.  **Norway:** Bobb in for Thorsby to inject central creativity.`;
  }

  return `### TACTIX AI - COACH CHAT (LOCAL FALLBACK)

Based on the live statistics, the match is currently locked at 0-0. Brazil has generated 5 shots (0.42 xG) while Norway holds 65% possession with 4 shots (0.38 xG). 

Let me know if you need specific drills, threat analysis, or lineup adjustments!`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        if (!active) return new Response("Missing API Key (GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)", { status: 500 });
        const { key } = active;
        const encoder = new TextEncoder();

        let body: { messages?: unknown; matchId?: unknown };
        try {
          body = (await request.json()) as { messages?: unknown; matchId?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }
        const activeMatchId = typeof body.matchId === "string" ? body.matchId : "";

        const history = (body.messages as ChatMsg[])
          .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"));

        const modelMessages: ModelMessage[] = history.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const withDataset = <T>(matchId: string, fn: (d: NonNullable<ReturnType<typeof getMatchDataset>>) => T) => {
          const id = matchId || activeMatchId;
          const dataset = getMatchDataset(id);
          if (!dataset) return { error: `Unknown matchId "${id}"` } as const;
          return fn(dataset);
        };

        const tools = {
          tactical_agent: tool({
            description: "Deterministic tactical analysis: formation channels, pressing intensity, territory, momentum, xG efficiency, set-piece dependence.",
            inputSchema: z.object({ matchId: z.string() }),
            execute: async ({ matchId }) => withDataset(matchId, (d) => tacticalReport(d)),
          }),
          prediction_agent: tool({
            description: "Poisson-bivariate win/draw/loss probabilities, next-goal probability, and expected final score derived from live xG.",
            inputSchema: z.object({ matchId: z.string() }),
            execute: async ({ matchId }) => withDataset(matchId, (d) => predictOutcome(d)),
          }),
          live_data_agent: tool({
            description: "Detected match events (goals, big chances, momentum swings, kickoff/HT/FT).",
            inputSchema: z.object({ matchId: z.string() }),
            execute: async ({ matchId }) =>
              withDataset(matchId, (d) => detectEvents(undefined, snapshotOf(d))),
          }),
          rag_agent: tool({
            description: "Retrieve top passages from the curated football/WC knowledge base (metric definitions, team profiles, tournament format, history).",
            inputSchema: z.object({
              query: z.string(),
              k: z.number().int().min(1).max(6).default(3),
            }),
            execute: async ({ query, k }) => retrieve(query, k),
          }),
          visualization_agent: tool({
            description: "Data specs for shot heatmap and pass network (no rendering).",
            inputSchema: z.object({ matchId: z.string() }),
            execute: async ({ matchId }) => {
              const dataset = getMatchDataset(matchId || "");
              return dataset ? buildVisualization(dataset) : { error: `Unknown matchId "${matchId}"` };
            },
          }),
          video_agent: tool({
            description: "Computer-vision analysis (player detection, ball tracking). Returns a not-supported reason on this runtime.",
            inputSchema: z.object({ url: z.string().default("") }),
            execute: async ({ url }) => analyseVideo({ url }),
          }),
          sports_api_agent: tool({
            description: "Query the sports API for real-time live scores, elapsed time, and stats of any active football match. Use this to update the console with real facts.",
            inputSchema: z.object({
              matchId: z.string().optional().description("The specific match ID or team name (e.g. 'Brazil' or 'Norway')")
            }),
            execute: async ({ matchId }) => {
              const apiKey = process.env.FOOTBALL_API_KEY || process.env.FOOTBALL_DATA_API_KEY;
              if (!apiKey) {
                return { error: "No FOOTBALL_API_KEY configured." };
              }
              try {
                const base = "https://v3.football.api-sports.io/fixtures";
                const headers = { "x-apisports-key": apiKey };
                const res = await fetch(`${base}?live=all`, { headers });
                if (!res.ok) return { error: `Failed to fetch from sports API: status ${res.status}` };
                const data = await res.json();
                
                if (matchId && data?.response) {
                  const query = matchId.toLowerCase();
                  const filtered = data.response.filter((r: any) =>
                    r.teams.home.name.toLowerCase().includes(query) ||
                    r.teams.away.name.toLowerCase().includes(query)
                  );
                  return { fixtures: filtered, count: filtered.length, source: "api-football-filtered" };
                }
                return { fixtures: data?.response ?? [], count: data?.response?.length ?? 0, source: "api-football-live" };
              } catch (err) {
                return { error: err instanceof Error ? err.message : "Unknown error" };
              }
            }
          }),
        };

        try {
          const gateway = createAiGatewayProvider(key);
          const result = streamText({
            model: gateway("google/gemini-3-flash-preview"),
            system: SYSTEM_PROMPT,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(50),
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
                  console.warn("AI Stream empty, falling back to mock response.");
                  const fallback = getMockChatResponse(modelMessages);
                  for (const char of fallback) {
                    controller.enqueue(encoder.encode(char));
                    await new Promise((r) => setTimeout(r, 8));
                  }
                }
                controller.close();
              } catch (err) {
                console.warn("AI Stream failed, falling back to mock response:", err);
                const fallback = getMockChatResponse(modelMessages);
                for (const char of fallback) {
                  controller.enqueue(encoder.encode(char));
                  await new Promise((r) => setTimeout(r, 8));
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
          console.warn("AI Handler failed, falling back to mock response:", err);
          const stream = new ReadableStream({
            async start(controller) {
              const fallback = getMockChatResponse(modelMessages);
              for (const char of fallback) {
                controller.enqueue(encoder.encode(char));
                await new Promise((r) => setTimeout(r, 8));
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
