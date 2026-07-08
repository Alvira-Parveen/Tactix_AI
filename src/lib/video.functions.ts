import { createServerFn } from "@tanstack/react-start";
import { analyseFrame, type VideoAnalysis } from "@/lib/agents/video";

export const analyseFrameFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): { imageDataUrl?: string; imageDataUrls?: string[]; note?: string } => {
    const d = input as { imageDataUrl?: unknown; imageDataUrls?: unknown; note?: unknown };
    const list: string[] = [];
    if (Array.isArray(d?.imageDataUrls)) {
      for (const v of d.imageDataUrls) {
        if (typeof v === "string" && v.length >= 32) list.push(v);
      }
    }
    if (list.length === 0 && typeof d?.imageDataUrl === "string" && d.imageDataUrl.length >= 32) {
      list.push(d.imageDataUrl);
    }
    if (list.length === 0) throw new Error("imageDataUrl(s) required");
    if (list.length > 6) throw new Error("Too many frames (max 6)");
    const total = list.reduce((n, s) => n + s.length, 0);
    if (total > 12_000_000) throw new Error("Frames too large (max ~9MB combined)");
    return {
      imageDataUrls: list,
      note: typeof d.note === "string" ? d.note.slice(0, 500) : undefined,
    };
  })
  .handler(async ({ data }): Promise<VideoAnalysis> => {
    return analyseFrame(data);
  });
