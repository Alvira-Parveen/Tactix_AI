import { createFileRoute } from "@tanstack/react-router";
import { aiGatewayFetch, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        if (!active) return new Response("Missing API Key (GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)", { status: 500 });

        let body: { input?: unknown; voice?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const input = typeof body.input === "string" ? body.input.slice(0, 4000) : "";
        const voice = typeof body.voice === "string" ? body.voice : "alloy";
        if (!input.trim()) return new Response("Missing input", { status: 400 });

        const res = await aiGatewayFetch("/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input,
            voice,
            response_format: "mp3",
            instructions: "Speak like a calm, insightful football tactical analyst. Clear pacing, confident.",
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(text || `TTS failed: ${res.status}`, { status: res.status });
        }
        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
