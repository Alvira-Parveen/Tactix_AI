import { createFileRoute } from "@tanstack/react-router";
import { aiGatewayFetch, getActiveAiKeyAndType } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const active = getActiveAiKeyAndType();
        if (!active) return new Response("Missing API Key (GATEWAY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)", { status: 500 });

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return new Response("Expected multipart/form-data", { status: 400 });
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return new Response("Missing audio file", { status: 400 });
        }
        if (file.size < 512) {
          return new Response("Recording too short", { status: 400 });
        }

        const language = (form.get("language") as string | null) ?? undefined;

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        // Choose an extension matching the recorded container so the model can decode it.
        const mime = file.type.split(";")[0];
        const ext =
          mime === "audio/webm" ? "webm" :
          mime === "audio/mp4"  ? "mp4"  :
          mime === "audio/mpeg" ? "mp3"  :
          mime === "audio/wav"  ? "wav"  :
          mime === "audio/ogg"  ? "ogg"  : "webm";
        upstream.append("file", file, `recording.${ext}`);
        if (language && language.length === 2) upstream.append("language", language);

        const res = await aiGatewayFetch("/v1/audio/transcriptions", {
          method: "POST",
          body: upstream,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(text || `Transcription failed: ${res.status}`, { status: res.status });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
