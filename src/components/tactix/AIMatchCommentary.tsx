import { useEffect, useMemo, useRef, useState } from "react";
import { useMatchData } from "@/lib/match-context";
import type { ShotEvent, Insight, MatchDataset } from "@/lib/match-data";

// ─── AI Match Commentary ──────────────────────────────────────────────────
// Generates narrative, broadcaster-style commentary lines from the shot
// timeline and tactical insights, blended and sorted by minute. Every line
// is derived from an event in the dataset — no hardcoded text — so it stays
// consistent with the rest of the dashboard.

type CommentaryLine = {
  id: string;
  minute: number;
  tone: "goal" | "chance" | "danger" | "tactical" | "note";
  text: string;
};

function xGDescriptor(xG: number) {
  if (xG >= 0.5) return "a gilt-edged chance";
  if (xG >= 0.3) return "a genuine opportunity";
  if (xG >= 0.15) return "a decent look";
  return "a low-percentage effort";
}

function shotToLine(shot: ShotEvent, dataset: MatchDataset): CommentaryLine {
  const teamName = shot.team === "home" ? dataset.match.home.name : dataset.match.away.name;
  const oppName = shot.team === "home" ? dataset.match.away.name : dataset.match.home.name;
  const xG = shot.xG.toFixed(2);
  const descriptor = xGDescriptor(shot.xG);

  let text = "";
  let tone: CommentaryLine["tone"] = "chance";

  switch (shot.outcome) {
    case "goal":
      tone = "goal";
      text = `GOAL — ${shot.player} strikes for ${teamName}. The AI model rated it at ${xG} xG — ${descriptor} converted with conviction.`;
      break;
    case "on-target":
      tone = shot.xG >= 0.3 ? "danger" : "chance";
      text = `${shot.player} tests the ${oppName} keeper — ${descriptor} (${xG} xG) forced a save and swung momentum.`;
      break;
    case "blocked":
      tone = "chance";
      text = `${teamName} carve out ${descriptor} through ${shot.player} (${xG} xG), but a body gets in the way inside the box.`;
      break;
    case "off-target":
    default:
      tone = "note";
      text = `${shot.player} pulls the trigger for ${teamName} — ${descriptor} at ${xG} xG drifts wide of the frame.`;
      break;
  }

  return { id: `s-${shot.id}`, minute: shot.minute, tone, text };
}

function insightMinute(label: string): number {
  const digits = label.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function insightToLine(ins: Insight): CommentaryLine {
  const minute = insightMinute(ins.minute);
  const tone: CommentaryLine["tone"] =
    ins.kind === "danger" ? "danger" : ins.kind === "insight" ? "tactical" : "note";
  return { id: `i-${ins.id}`, minute, tone, text: ins.body };
}

function toneStyle(tone: CommentaryLine["tone"]) {
  switch (tone) {
    case "goal":
      return { dot: "bg-primary shadow-[0_0_8px_currentColor] text-primary", label: "GOAL", labelColor: "text-primary" };
    case "danger":
      return { dot: "bg-danger text-danger", label: "DANGER", labelColor: "text-danger" };
    case "chance":
      return { dot: "bg-primary/70 text-primary", label: "CHANCE", labelColor: "text-primary" };
    case "tactical":
      return { dot: "bg-primary/50 text-primary", label: "TACTICAL", labelColor: "text-primary" };
    case "note":
    default:
      return { dot: "bg-muted/60 text-muted", label: "NOTE", labelColor: "text-muted" };
  }
}

export function AIMatchCommentary() {
  const dataset = useMatchData();
  const [mode, setMode] = useState<"derived" | "ai">("derived");
  const [aiText, setAiText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lines = useMemo<CommentaryLine[]>(() => {
    const shotLines = dataset.shots.map((s) => shotToLine(s, dataset));
    const insightLines = dataset.insights.map(insightToLine);
    const merged = [...shotLines, ...insightLines];
    merged.sort((a, b) => b.minute - a.minute);
    return merged;
  }, [dataset]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function streamAI() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    setErr(null);
    setAiText("");
    setMode("ai");
    try {
      const res = await fetch("/api/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: dataset.match.id }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setErr(res.status === 402 ? "AI credits exhausted." : res.status === 429 ? "Rate limited — retry shortly." : `Server error ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAiText(acc);
      }
    } catch (e) {
      const aborted = ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
      if (!aborted) setErr(`Stream failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setStreaming(false);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">AI Match Commentary</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { abortRef.current?.abort(); setMode("derived"); }}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              mode === "derived" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
            }`}
          >
            Derived
          </button>
          <button
            type="button"
            onClick={streaming ? stop : streamAI}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              mode === "ai" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {streaming ? "Stop" : mode === "ai" ? "Regenerate" : "AI Stream"}
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <div>
          {err && <div className="mb-2 rounded border border-danger/30 bg-danger/5 px-2 py-1 text-xs text-danger">{err}</div>}
          {aiText.length === 0 && !streaming && !err && (
            <p className="text-xs text-muted">Click "AI Stream" to generate live broadcaster-style commentary from this match's events.</p>
          )}
          {streaming && aiText.length === 0 && (
            <div className="font-mono text-[11px] text-muted">TACTIX is narrating…</div>
          )}
          {aiText.length > 0 && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{aiText}{streaming && <span className="animate-pulse text-primary">▍</span>}</pre>
          )}
        </div>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted">
          Commentary will start streaming once the first on-ball event is recorded.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-border/70 pl-4">
          {lines.map((line) => {
            const s = toneStyle(line.tone);
            return (
              <li key={line.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 inline-block h-2 w-2 rounded-full ${s.dot}`}
                  aria-hidden
                />
                <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                  <span className="text-muted">{line.minute > 0 ? `${line.minute}'` : "—"}</span>
                  <span className={s.labelColor}>{s.label}</span>
                </div>
                <p className="text-pretty text-sm leading-relaxed text-foreground">{line.text}</p>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 border-t border-border pt-2 font-mono text-[10px] leading-relaxed text-muted/80">
        Derived · lines built from real events. AI Stream · Gemini narrates the same events in broadcaster prose.
      </p>
    </div>
  );
}
