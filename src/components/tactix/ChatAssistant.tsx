import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMatchData } from "@/lib/match-context";
import type { ChatMessage } from "@/lib/match-data";

const STORAGE_PREFIX = "tactix.chat.v2:";

type StreamStatus = "ok" | "error" | "aborted";
type AssistantMessage = ChatMessage & { status?: StreamStatus; errorText?: string };

function loadPersisted(matchId: string): AssistantMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + matchId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssistantMessage[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (m) => m && typeof m.id === "string" && typeof m.text === "string" && (m.role === "user" || m.role === "assistant"),
    );
  } catch {
    return null;
  }
}

export function ChatAssistant({ prefill }: { prefill?: string }) {
  const { match, seedChat, suggestedQuestions } = useMatchData();
  const matchId = match.id;
  const navigate = useNavigate();

  const [messages, setMessages] = useState<AssistantMessage[]>(() => loadPersisted(matchId) ?? seedChat);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const consumedPrefillRef = useRef<string | null>(null);

  // Consume ?ask= prefill: set input, focus, and clear the URL param so
  // refreshes don't re-inject the question.
  useEffect(() => {
    if (!prefill) return;
    if (consumedPrefillRef.current === prefill) return;
    consumedPrefillRef.current = prefill;
    setInput(prefill);
    // Focus after paint so the caret lands at the end.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        try { el.setSelectionRange(end, end); } catch { /* ignore */ }
      }
    });
    navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, ask: undefined }), replace: true });
  }, [prefill, navigate]);

  // When the match changes, load its history (or seed).
  useEffect(() => {
    abortRef.current?.abort();
    setMessages(loadPersisted(matchId) ?? seedChat);
    setInput("");
    setThinking(false);
    setStreaming(false);
  }, [matchId, seedChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(messages));
    } catch {
      // ignore quota
    }
  }, [messages, matchId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function clearHistory() {
    abortRef.current?.abort();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + matchId);
      } catch {
        // ignore
      }
    }
    setMessages(seedChat);
  }

  function stop() {
    abortRef.current?.abort();
  }

  const runQuery = useCallback(
    async (history: AssistantMessage[], assistantId: string) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      setThinking(true);
      setStreaming(true);
      let opened = false;
      let accumulated = "";

      const updateAssistant = (patch: Partial<AssistantMessage>) => {
        setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, ...patch } : msg)));
      };

      const appendAssistant = (msg: AssistantMessage) => {
        setMessages((m) => [...m, msg]);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            messages: history
              .filter((m) => m.role === "user" || (m.role === "assistant" && m.status !== "error"))
              .map((m) => ({ role: m.role, content: m.text })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let errText: string;
          if (res.status === 429) errText = "Rate limit reached — please wait a moment before retrying.";
          else if (res.status === 402) errText = "AI credits exhausted for this workspace. Add credits to continue.";
          else errText = `Server error ${res.status}: ${(await res.text().catch(() => "")) || "unknown"}`;
          appendAssistant({ id: assistantId, role: "assistant", text: "", status: "error", errorText: errText });
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
            appendAssistant({ id: assistantId, role: "assistant", text: accumulated, status: "ok" });
          } else {
            updateAssistant({ text: accumulated });
          }
        }

        if (!opened) {
          appendAssistant({
            id: assistantId,
            role: "assistant",
            text: "",
            status: "error",
            errorText: "Stream ended before any response was received.",
          });
        } else {
          updateAssistant({ status: "ok" });
        }
      } catch (err) {
        const aborted = controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError");
        const errText = aborted
          ? "Response canceled."
          : `Connection lost: ${err instanceof Error ? err.message : "unknown error"}`;
        const status: StreamStatus = aborted ? "aborted" : "error";

        if (opened) {
          updateAssistant({ status, errorText: errText });
        } else {
          appendAssistant({ id: assistantId, role: "assistant", text: accumulated, status, errorText: errText });
        }
      } finally {
        setThinking(false);
        setStreaming(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [matchId],
  );

  function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    const userMsg: AssistantMessage = { id: crypto.randomUUID(), role: "user", text: q };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    void runQuery(next, crypto.randomUUID());
  }

  function retry() {
    if (streaming) return;
    const trimmed = [...messages];
    while (trimmed.length > 0) {
      const last = trimmed[trimmed.length - 1];
      if (last.role === "assistant" && (last.status === "error" || last.status === "aborted")) {
        trimmed.pop();
      } else {
        break;
      }
    }
    const lastUserIdx = [...trimmed].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    setMessages(trimmed);
    void runQuery(trimmed, crypto.randomUUID());
  }

  const lastMsg = messages[messages.length - 1];
  const canRetry =
    !streaming &&
    !!lastMsg &&
    lastMsg.role === "assistant" &&
    (lastMsg.status === "error" || lastMsg.status === "aborted");

  return (
    <div className="flex min-h-[380px] flex-1 flex-col rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-white/5 p-3">
        <div className="flex items-center gap-2">
          <div className={`size-2 rounded-full ${streaming ? "bg-primary animate-pulse" : "bg-primary"}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Tactix AI Chat</span>
          <span className="font-mono text-[10px] text-muted">
            · {match.home.code} v {match.away.code}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted">Grounded · RAG v4.1</span>
          <button
            type="button"
            onClick={clearHistory}
            className="font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-primary"
            title="Clear this match's chat history"
          >
            Clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="rounded border border-white/5 bg-white/5 p-2 font-mono text-xs italic text-muted">
                "{m.text}"
              </div>
            );
          }
          const isError = m.status === "error";
          const isAborted = m.status === "aborted";
          return (
            <div key={m.id} className="space-y-1">
              {m.text && <div className="text-pretty leading-relaxed text-foreground">{m.text}</div>}
              {(isError || isAborted) && (
                <div
                  className={`flex items-start gap-2 rounded border px-2 py-1.5 font-mono text-[10px] ${
                    isError ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-white/10 bg-white/5 text-muted"
                  }`}
                >
                  <span className="mt-[1px]">{isError ? "⚠" : "◼"}</span>
                  <span className="flex-1">{m.errorText ?? (isError ? "Stream failed." : "Canceled.")}</span>
                </div>
              )}
            </div>
          );
        })}
        {thinking && (
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            <span className="size-1 animate-[pulse-glow_1s_infinite] rounded-full bg-primary" />
            <span className="size-1 animate-[pulse-glow_1s_infinite] rounded-full bg-primary" style={{ animationDelay: "0.15s" }} />
            <span className="size-1 animate-[pulse-glow_1s_infinite] rounded-full bg-primary" style={{ animationDelay: "0.3s" }} />
            <span className="ml-2">Analyzing tactical context…</span>
          </div>
        )}
      </div>

      {canRetry && lastMsg?.role === "assistant" && (lastMsg.status === "error" || lastMsg.status === "aborted") && (
        <div className="flex items-center justify-between border-t border-border bg-red-500/5 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {lastMsg.status === "aborted" ? "Response canceled" : "Stream disconnected"}
          </span>
          <button
            type="button"
            onClick={retry}
            className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            ↻ Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
        {suggestedQuestions.slice(0, 3).map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={streaming}
            className="rounded border border-border bg-background px-2 py-1 text-left font-mono text-[10px] text-muted transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={streaming ? "Streaming response…" : "Ask about formation changes…"}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20"
            >
              ◼ Stop
            </button>
          ) : (
            <span className="font-mono text-[10px] text-muted">/</span>
          )}
        </div>
      </form>
    </div>
  );
}
