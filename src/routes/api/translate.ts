import { createFileRoute } from "@tanstack/react-router";
import { aiGatewayFetch, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";

const TARGET_NAME: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  ar: "Arabic",
  en: "English",
};

export const Route = createFileRoute("/api/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        if (!active) return new Response("Missing API Key (GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)", { status: 500 });

        let body: { text?: unknown; target?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const text = typeof body.text === "string" ? body.text : "";
        const target = typeof body.target === "string" ? body.target : "en";
        if (!text.trim()) return Response.json({ translated: text });
        if (target === "en") return Response.json({ translated: text });
        const language = TARGET_NAME[target] ?? target;

        const res = await aiGatewayFetch("/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a professional football/soccer translator. Translate the user's text into ${language}. Preserve markdown, numbers, player and team names, and tactical terms (xG, PPDA, 4-3-3). Output ONLY the translation, no preamble.`,
              },
              { role: "user", content: text },
            ],
          }),
        });
        if (!res.ok) {
          return new Response(await res.text().catch(() => "translate failed"), { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const translated = data.choices?.[0]?.message?.content?.trim() ?? text;
        return Response.json({ translated });
      },
    },
  },
});
