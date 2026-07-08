import { useState } from "react";

// ─── Share Button ─────────────────────────────────────────────────────────
// Uses the Web Share API when available (mobile), otherwise falls back to
// copy-to-clipboard. Renders in the "compact" style used by the TopNav.

export function ShareButton({
  title,
  text,
  className = "",
}: {
  title?: string;
  text?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    setError(null);
    if (typeof window === "undefined") return;
    const url = window.location.href;

    // Prefer the native share sheet on mobile/PWA.
    const nav = window.navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Otherwise (NotAllowedError in sandboxed iframes) fall through to copy.
      }
    }

    // Async Clipboard API — may fail in sandboxed iframes.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // fall through to execCommand fallback
    }

    // Legacy fallback: hidden textarea + execCommand("copy").
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      throw new Error("execCommand failed");
    } catch {
      // Last resort: show the URL so the user can copy it manually.
      window.prompt("Copy this link:", url);
    }
  };

  const label = error ?? (copied ? "Link copied" : "Share");

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share this page"
      className={`inline-flex items-center gap-1.5 rounded border border-border bg-card/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:border-primary/40 hover:text-primary ${className}`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
