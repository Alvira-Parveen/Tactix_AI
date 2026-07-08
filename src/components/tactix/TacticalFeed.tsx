import { useMatchData } from "@/lib/match-context";
import type { Insight } from "@/lib/match-data";

function styleFor(kind: Insight["kind"]) {
  switch (kind) {
    case "insight":
      return {
        wrapper: "bg-card border-l-2 border-primary ring-1 ring-white/5",
        label: "text-primary",
        body: "text-foreground font-medium",
      };
    case "danger":
      return {
        wrapper: "bg-danger/5 border-l-2 border-danger ring-1 ring-danger/10",
        label: "text-danger",
        body: "text-foreground",
      };
    case "alert":
    default:
      return {
        wrapper: "bg-white/5 border-l-2 border-muted/30",
        label: "text-muted",
        body: "text-muted",
      };
  }
}

const HIGHLIGHT_TOKENS = /(3-box-3|4-2-3-1|4-3-3|3-2-5|5-3-2|PPDA|xG|xA|mid-block|high press|half-space)/g;

function highlight(text: string) {
  const parts = text.split(HIGHLIGHT_TOKENS);
  return parts.map((part, i) =>
    HIGHLIGHT_TOKENS.test(part) ? (
      <span key={i} className="text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function TacticalFeed({ minute }: { minute: string }) {
  const { insights } = useMatchData();
  return (
    <section className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-xs font-bold uppercase tracking-widest">Tactical Intelligence</h2>
        <span className="font-mono text-[10px] text-muted">{minute}</span>
      </div>

      <div className="flex max-h-[calc(100vh-200px)] flex-col gap-3 overflow-y-auto pr-2">
        {insights.map((i, idx) => {
          const s = styleFor(i.kind);
          return (
            <div
              key={i.id}
              className={`animate-[draw-line_0.6s_var(--ease-out-expo)_both] p-4 ${s.wrapper}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="mb-2 flex justify-between">
                <span className={`font-mono text-[10px] ${s.label}`}>{i.label}</span>
                <span className="font-mono text-[10px] text-muted">{i.minute}</span>
              </div>
              <p className={`text-pretty text-sm leading-relaxed ${s.body}`}>{highlight(i.body)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
