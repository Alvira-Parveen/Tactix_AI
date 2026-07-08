import { Link } from "@tanstack/react-router";
import { useMatchData } from "@/lib/match-context";
import { LanguageSwitcher } from "@/components/tactix/LanguageSwitcher";

export function TopNav() {
  const { match } = useMatchData();
  const badgeColor =
    match.status === "live"
      ? "border-danger/20 bg-danger/10 text-danger"
      : match.status === "upcoming"
        ? "border-primary/20 bg-primary/10 text-primary"
        : "border-white/10 bg-white/5 text-muted";
  const badgeLabel =
    match.status === "live"
      ? `Live: ${match.stage}`
      : match.status === "upcoming"
        ? `Upcoming: ${match.stage}`
        : `Final: ${match.stage}`;

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-sm bg-primary">
            <div className="size-2 rotate-45 bg-background" />
          </div>
          <span className="text-lg font-bold uppercase tracking-tighter">
            Tactix AI
          </span>
        </Link>
        <div className="hidden gap-6 text-xs font-medium uppercase tracking-widest text-muted md:flex">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            Match Hub
          </Link>
          <Link
            to="/history"
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            History
          </Link>
          <Link
            to="/chat"
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            AI Chat
          </Link>
          <Link
            to="/players"
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            Players
          </Link>
          <span className="mt-4 border-b border-primary pb-4 text-foreground">
            Live Dashboard
          </span>
          <Link
            to="/coach/$matchId"
            params={{ matchId: match.id }}
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            AI Coach
          </Link>
          <Link
            to="/intel/$matchId"
            params={{ matchId: match.id }}
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            Intelligence
          </Link>
          <Link
            to="/sim/$matchId"
            params={{ matchId: match.id }}
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            Simulator
          </Link>
          <Link
            to="/cv/$matchId"
            params={{ matchId: match.id }}
            className="mt-4 pb-4 transition-colors hover:text-foreground"
            activeProps={{ className: "mt-4 border-b border-primary pb-4 text-foreground" }}
          >
            Vision
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${badgeColor}`}>
          {match.status === "live" && (
            <div className="size-2 animate-[pulse-glow_2s_infinite] rounded-full bg-danger" />
          )}
          <span className="text-[10px] font-bold uppercase">{badgeLabel}</span>
        </div>
        <div className="size-8 rounded-full border border-white/5 bg-border" />
      </div>
    </nav>
  );
}
