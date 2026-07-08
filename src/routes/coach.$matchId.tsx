import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChatAssistant } from "@/components/tactix/ChatAssistant";
import { MatchProvider } from "@/lib/match-context";
import { getMatchDataset } from "@/lib/match-data";
import { generateCoachAnalysis, type CoachAnalysis } from "@/lib/coach-analysis";

export const Route = createFileRoute("/coach/$matchId")({
  validateSearch: (search: Record<string, unknown>) => ({
    ask: typeof search.ask === "string" ? search.ask : undefined,
  }),
  loader: ({ params }) => {
    const dataset = getMatchDataset(params.matchId);
    if (!dataset) throw notFound();
    return dataset;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "AI Coach — TACTIX AI" }, { name: "robots", content: "noindex" }] };
    }
    const { match } = loaderData;
    const title = `AI Coach · ${match.home.name} vs ${match.away.name} — TACTIX AI`;
    const description = `Dedicated tactical AI coach for ${match.home.name} vs ${match.away.name}. Drill formations, press schemes, and match-up plans in a focused chat surface.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CoachDashboard,
  notFoundComponent: CoachNotFound,
  errorComponent: CoachError,
});

const COACH_DRILLS: { title: string; prompt: (h: string, a: string) => string }[] = [
  {
    title: "Full pre-match plan",
    prompt: (h, a) =>
      `Give me a full pre-match tactical plan for ${h} vs ${a}. Cover formation, out-of-possession shape, pressing triggers, set-piece priorities, and 3 in-game decision triggers.`,
  },
  {
    title: "Half-time adjustments",
    prompt: (h, a) =>
      `Based on the current stats and momentum, what 3 concrete half-time adjustments should ${h} make vs ${a}? Give changes to shape, personnel, and pressing.`,
  },
  {
    title: "Neutralize their #1 threat",
    prompt: (h, a) =>
      `Identify ${a}'s single biggest tactical threat in this match and give me a specific, actionable plan for ${h} to neutralize it.`,
  },
  {
    title: "Exploit their weakness",
    prompt: (h, a) =>
      `Where is ${a}'s biggest structural weakness in this match, and how should ${h} attack it? Reference the current xG and momentum picture.`,
  },
  {
    title: "Set-piece playbook",
    prompt: (h, a) =>
      `Design a 3-routine set-piece playbook (2 attacking, 1 defensive) tailored to ${h} vs ${a} in this game state.`,
  },
  {
    title: "Substitution ladder",
    prompt: (h, a) =>
      `Build a 60'–90' substitution ladder for ${h} vs ${a}: who comes off, who comes on, what tactical change each sub enables.`,
  },
];

function CoachDashboard() {
  const dataset = Route.useLoaderData();
  const { ask } = Route.useSearch();
  const { match } = dataset;

  return (
    <MatchProvider dataset={dataset}>
      <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30">
        <header className="border-b border-border bg-surface/40 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                AI Coach · {match.stage}
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                {match.home.name} <span className="text-muted">vs</span> {match.away.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/match/$matchId"
                params={{ matchId: match.id }}
                className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
              >
                ← Live Dashboard
              </Link>
              <Link
                to="/intel/$matchId"
                params={{ matchId: match.id }}
                className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
              >
                Intel
              </Link>
              <Link
                to="/sim/$matchId"
                params={{ matchId: match.id }}
                className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
              >
                Simulator
              </Link>
              <Link
                to="/"
                className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
              >
                Match Hub
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 p-6">
          <aside className="col-span-12 lg:col-span-4">
            <div className="rounded border border-border bg-surface/40 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">Coach Briefing</div>
              <p className="text-sm leading-relaxed text-foreground/90">
                You're on the touchline. Ask for a full plan, a specific adjustment, or drill a single moment.
                Every answer is grounded in the live match feed, xG, and momentum.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <MiniStat label={`${match.home.code} score`} value={String(match.homeScore)} />
                <MiniStat label="Clock" value={match.status === "live" ? `${match.minute}'` : match.half} />
                <MiniStat label={`${match.away.code} score`} value={String(match.awayScore)} />
              </div>
            </div>

            <VideoAnalyzer />





            <div className="mt-4 rounded border border-border bg-surface/40 p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Drills</div>
              <div className="flex flex-col gap-1.5">
                {COACH_DRILLS.map((d) => {
                  const prompt = d.prompt(match.home.name, match.away.name);
                  return (
                    <Link
                      key={d.title}
                      to="/coach/$matchId"
                      params={{ matchId: match.id }}
                      search={{ ask: prompt }}
                      replace
                      className="rounded border border-border bg-background/40 px-2 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="mr-2 font-mono text-[10px] text-primary">▸</span>
                      {d.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="col-span-12 flex lg:col-span-8">
            <ChatAssistant prefill={ask} />
          </section>
        </main>
      </div>
    </MatchProvider>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background/40 p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function VideoAnalyzer() {
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    setErrorMsg(null);
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|mkv|webm|m4v)$/i)) {
      setErrorMsg("Please upload a video file (mp4, mov, mkv, webm).");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setProgress(0);
    // Simulated pipeline: upload → analyze → done.
    let p = 0;
    const uploadTick = setInterval(() => {
      p += 12 + Math.random() * 8;
      if (p >= 100) {
        clearInterval(uploadTick);
        setProgress(100);
        setStatus("analyzing");
        setTimeout(() => {
          setAnalysis(generateCoachAnalysis(file.name));
          setStatus("done");
        }, 1600);
      } else {
        setProgress(Math.round(p));
      }
    }, 220);
  }

  function reset() {
    setStatus("idle");
    setAnalysis(null);
    setProgress(0);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mt-4 rounded border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Upload footage</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Match · Highlights · Training</div>
      </div>

      {status === "idle" && (
        <label
          htmlFor="coach-video-upload"
          className="flex cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border bg-background/40 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          <div className="font-mono text-[11px] uppercase tracking-wider text-foreground">Drop video or click to select</div>
          <div className="mt-1 font-mono text-[10px] text-muted">AI detects formation, strengths, weaknesses, ratings</div>
          <input
            id="coach-video-upload"
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      )}

      {(status === "uploading" || status === "analyzing") && (
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-primary">
            <span>{status === "uploading" ? "Ingesting footage…" : "AI analyzing possessions…"}</span>
            <span>{status === "uploading" ? `${progress}%` : "…"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-background/40">
            <div
              className={`h-full transition-all ${status === "analyzing" ? "animate-pulse bg-primary" : "bg-primary/70"}`}
              style={{ width: status === "analyzing" ? "100%" : `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded border border-danger/30 bg-danger/5 p-2 font-mono text-[11px] text-danger">
          {errorMsg}
          <button
            type="button"
            onClick={reset}
            className="ml-2 rounded border border-danger/40 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:bg-danger/10"
          >
            Retry
          </button>
        </div>
      )}

      {status === "done" && analysis && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {analysis.filename}
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-primary/40 hover:text-primary"
            >
              ↺ New
            </button>
          </div>

          <AnalysisRow label="Formation" value={analysis.formation} tone="primary" />

          <div>
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">Strengths</div>
            <ul className="ml-3 list-disc space-y-0.5 text-foreground/85">
              {analysis.strengths.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-danger">Weaknesses</div>
            <ul className="ml-3 list-disc space-y-0.5 text-foreground/85">
              {analysis.weaknesses.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">Defensive errors</div>
            <ul className="ml-3 list-disc space-y-0.5 text-foreground/85">
              {analysis.defensiveErrors.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">Attacking patterns</div>
            <ul className="ml-3 list-disc space-y-0.5 text-foreground/85">
              {analysis.attackingPatterns.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Player ratings</div>
            <ul className="divide-y divide-border rounded border border-border">
              {analysis.ratings.map((r) => (
                <li key={r.player} className="flex items-start justify-between gap-2 p-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">{r.player}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-foreground/75">{r.reason}</div>
                  </div>
                  <div
                    className={`shrink-0 font-mono text-sm font-bold ${
                      r.score >= 8 ? "text-primary" : r.score >= 7 ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {r.score.toFixed(1)}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-primary/30 bg-primary/5 p-2">
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">Recommendation</div>
            <div className="text-foreground/90">{analysis.recommendation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisRow({ label, value, tone }: { label: string; value: string; tone: "primary" | "muted" }) {
  return (
    <div className={`flex items-center justify-between rounded border px-2 py-1.5 ${tone === "primary" ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span className={`font-mono text-sm font-bold ${tone === "primary" ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function CoachNotFound() {
  const { matchId } = Route.useParams();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md text-center">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Coach unavailable</div>
        <h1 className="mb-2 text-2xl font-bold">No coaching pack for "{matchId}"</h1>
        <p className="mb-6 text-sm text-muted">The coach only works on fixtures loaded in the model.</p>
        <Link to="/" className="inline-block rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20">
          ← Back to Match Hub
        </Link>
      </div>
    </div>
  );
}

function CoachError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Coach failed to load</div>
        <pre className="mb-6 overflow-x-auto rounded border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger/90">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await router.invalidate();
              reset();
            }}
            className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            ↻ Retry
          </button>
          <Link to="/" className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground">
            ← Match Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
