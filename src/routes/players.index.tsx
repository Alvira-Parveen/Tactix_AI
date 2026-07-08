import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GitCompare, Search, User } from "lucide-react";
import { validatePlayerName } from "@/lib/player-intel";

// ─── Players search hub ──────────────────────────────────────────────────
// The search screen. Submitting navigates to /players/$name for the full
// profile view; the "Compare" tab goes to /players/compare. Client-side
// name validation mirrors the server-side rules for immediate feedback.

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "TACTIX AI — Player Intel" },
      { name: "description", content: "Search any football player and get an AI-generated profile: club, nation, career, honours, and interactive form charts." },
      { property: "og:title", content: "TACTIX AI — Player Intel" },
      { property: "og:description", content: "AI-powered football player search, profiles, and comparison." },
    ],
  }),
  component: PlayersHubPage,
});

const EXAMPLES = [
  "Lionel Messi",
  "Erling Haaland",
  "Kylian Mbappé",
  "Vinícius Júnior",
  "Bukayo Saka",
  "Zinedine Zidane",
  "Rodri",
  "Jude Bellingham",
];

function PlayersHubPage() {
  const navigate = useNavigate({ from: "/players" });
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const goToProfile = (raw: string, h = "") => {
    const v = validatePlayerName(raw);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    navigate({
      to: "/players/$name",
      params: { name: v.value },
      search: { hint: h.trim().slice(0, 120) },
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToProfile(name, hint);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HubNav />
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <header className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Player Intel · AI</div>
          <h1 className="text-2xl font-bold tracking-tight">Search any football player</h1>
          <p className="mt-1 text-sm text-muted">
            Get an AI-generated profile: club, nation, career timeline, honours, playing style, season stats, and match-by-match form charts.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded border border-border bg-surface/30 p-4 md:grid-cols-[2fr_1.2fr_auto]">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Player name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value.slice(0, 80)); if (error) setError(null); }}
              placeholder="e.g. Lionel Messi"
              className={`mt-1 w-full rounded border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none ${error ? "border-danger/50" : "border-border"}`}
              maxLength={80}
              autoFocus
            />
            {error && <div className="mt-1 font-mono text-[10px] text-danger">{error}</div>}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Hint (optional)</label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value.slice(0, 120))}
              placeholder="e.g. Argentina · Inter Miami"
              className="mt-1 w-full rounded border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              maxLength={120}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-[38px] items-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              <Search className="size-3.5" /> Search
            </button>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => goToProfile(ex)}
              className="rounded border border-border bg-background/40 px-2 py-1 font-mono text-[10px] text-muted hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        <Link
          to="/players/compare"
          search={{ names: "" }}
          className="mb-4 inline-flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10"
        >
          <GitCompare className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">Compare 2–4 players side-by-side</div>
            <div className="font-mono text-[10px] text-muted">Career totals, role, and season-by-season trend charts.</div>
          </div>
        </Link>

        <div className="grid gap-3 text-sm text-muted sm:grid-cols-3">
          <FeatureCard
            title="Timeline & honours"
            body="Every senior club with years, apps, and goals — plus international caps and every major trophy."
            onClick={() => goToProfile("Lionel Messi")}
          />
          <FeatureCard
            title="Form charts"
            body="Interactive line and bar charts for the last 5/10 matches, season goals+assists, and club vs country splits."
            onClick={() => goToProfile("Erling Haaland")}
          />
          <FeatureCard
            title="Confidence-aware"
            body="Every stat comes with a confidence badge; low-confidence and unknown players get a clear insufficient-data fallback."
            onClick={() => goToProfile("Kylian Mbappé")}
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, body, onClick }: { title: string; body: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded border border-border bg-surface/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-surface/60 active:scale-[0.99]"
    >
      <div className="mb-1 flex items-center gap-2">
        <User className="size-3.5 text-primary" />
        <div className="text-sm font-semibold text-foreground">{title}</div>
      </div>
      <p className="text-xs leading-relaxed">{body}</p>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted group-hover:text-primary">
        Try it →
      </div>
    </button>
  );
}

function HubNav() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-sm bg-primary">
          <div className="size-2 rotate-45 bg-background" />
        </div>
        <span className="text-lg font-bold uppercase tracking-tighter">Tactix AI</span>
      </Link>
      <div className="flex gap-6 text-xs font-medium uppercase tracking-widest text-muted">
        <Link to="/" className="hover:text-foreground">Match Hub</Link>
        <Link to="/history" className="hover:text-foreground">History</Link>
        <Link to="/chat" className="hover:text-foreground">AI Chat</Link>
        <span className="text-foreground border-b border-primary pb-1">Players</span>
        <Link to="/players/compare" search={{ names: "" }} className="hover:text-foreground">Compare</Link>
      </div>
    </nav>
  );
}
