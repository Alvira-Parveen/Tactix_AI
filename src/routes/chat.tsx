import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MATCHES } from "@/lib/match-data";
import { VoiceControls } from "@/components/tactix/VoiceControls";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "TACTIX AI Football Chat — ask a tactical analyst" },
      {
        name: "description",
        content:
          "Chat with TACTIX AI, an AI football analyst grounded in live World Cup data, tactical metrics, and a curated football knowledge base.",
      },
      { property: "og:title", content: "TACTIX AI Football Chat" },
      {
        property: "og:description",
        content: "Ask TACTIX AI about formations, pressing, xG, predictions and history — grounded in real match data.",
      },
    ],
  }),
  component: ChatPage,
});

type Msg = { id: string; role: "user" | "assistant"; text: string; status?: "ok" | "error" | "aborted"; errorText?: string };

const STORAGE_KEY = "tactix.standalone-chat.v1";

const STARTERS = [
  "Which team is generating more xG right now, and why?",
  "Explain PPDA in one paragraph.",
  "How does a 3-4-2-1 defend against a 4-3-3?",
  "Compare today's Spain to Spain 2010.",
  "What tactical shift would help the losing team?",
];

function loadPersisted(): Msg[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function ChatPage() {
  const defaultMatch = MATCHES[0]?.id ?? "";
  const [matchId, setMatchId] = useState<string>(defaultMatch);
  const [messages, setMessages] = useState<Msg[]>(() => loadPersisted() ?? []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota */
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || streaming) return;
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: q };
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setInput("");
      requestAnimationFrame(() => inputRef.current?.focus());

      const assistantId = crypto.randomUUID();
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      setStreaming(true);
      setThinking(true);
      let opened = false;
      let accumulated = "";

      const upsert = (patch: Partial<Msg>) =>
        setMessages((m) => {
          const has = m.some((x) => x.id === assistantId);
          if (!has) return [...m, { id: assistantId, role: "assistant", text: "", ...patch }];
          return m.map((x) => (x.id === assistantId ? { ...x, ...patch } : x));
        });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            messages: nextHistory
              .filter((m) => m.role === "user" || (m.role === "assistant" && m.status !== "error"))
              .map((m) => ({ role: m.role, content: m.text })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const err =
            res.status === 429
              ? "Rate limit reached — please wait a moment."
              : res.status === 402
                ? "AI credits exhausted for this workspace."
                : `Server error ${res.status}`;
          upsert({ status: "error", errorText: err });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          if (!opened) {
            opened = true;
            setThinking(false);
          }
          upsert({ text: accumulated, status: "ok" });
        }
        if (!opened) upsert({ status: "error", errorText: "Empty response." });
      } catch (err) {
        const aborted = controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError");
        upsert({
          text: accumulated,
          status: aborted ? "aborted" : "error",
          errorText: aborted ? "Canceled." : `Connection lost: ${err instanceof Error ? err.message : "unknown"}`,
        });
      } finally {
        setThinking(false);
        setStreaming(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [matchId, messages, streaming],
  );

  const lastAssistantText = useMemo(() => {
    if (streaming) return "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.status === "ok" && m.text.trim()) return m.text;
    }
    return "";
  }, [messages, streaming]);

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">AI Football Chat</div>
            <h1 className="text-xl font-bold tracking-tight">Ask the tactical analyst</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Grounded on</label>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="rounded border border-border bg-surface/60 px-2 py-1 font-mono text-[11px]"
            >
              {MATCHES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home.name} vs {m.away.name}
                </option>
              ))}
            </select>
            <Link
              to="/"
              className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              Match Hub
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-4 p-6">
        <div
          ref={scrollRef}
          className="min-h-[420px] max-h-[65vh] overflow-y-auto rounded border border-border bg-surface/30 p-4"
        >
          {messages.length === 0 && !thinking && (
            <div className="space-y-4">
              <div className="text-sm text-muted">
                Ask about formations, pressing, xG, predictions, or football history. Answers are grounded in the selected match plus a curated knowledge base.
              </div>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded border border-border bg-background/40 px-2 py-1 text-left text-xs hover:border-primary/40 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ol className="space-y-4">
            {messages.map((m) => (
              <li key={m.id}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] text-sm leading-relaxed">
                    {m.status === "error" ? (
                      <div className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-danger">
                        {m.errorText}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-foreground">
                        <ReactMarkdown>{m.text || "…"}</ReactMarkdown>
                        {m.status === "aborted" && (
                          <div className="mt-1 font-mono text-[10px] text-muted">— canceled</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {thinking && (
              <li>
                <div className="font-mono text-[11px] text-muted">TACTIX is thinking…</div>
              </li>
            )}
          </ol>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={streaming}
              rows={2}
              placeholder="Ask about tactics, xG, formations, or history…"
              className="flex-1 resize-none rounded border border-border bg-background/40 px-3 py-2 font-sans text-sm focus:border-primary/60 focus:outline-none"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="rounded border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-danger hover:bg-danger/20"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
            <span className="font-mono">Enter to send · Shift+Enter for newline</span>
            <div className="flex items-center gap-3">
              <VoiceControls
                disabled={streaming}
                onTranscript={(t) => send(t)}
                speak={lastAssistantText}
                autoSpeak={true}
              />
              <button type="button" onClick={clear} className="font-mono uppercase tracking-wider hover:text-foreground">
                Clear conversation
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
