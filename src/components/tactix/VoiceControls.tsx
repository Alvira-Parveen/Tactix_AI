import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  /** Optional text to play back as audio (assistant reply). */
  speak?: string;
  autoSpeak?: boolean;
};

export function VoiceControls({ disabled, onTranscript, speak, autoSpeak }: Props) {
  const { lang, t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<"" | "transcribing" | "speaking">("");
  const [error, setError] = useState<string | null>(null);
  const [mutedTTS, setMutedTTS] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenRef = useRef<string>("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1024) {
          setError("Recording too short. Try again.");
          return;
        }
        try {
          setBusy("transcribing");
          const fd = new FormData();
          const ext =
            (rec.mimeType || "").includes("mp4") ? "mp4" :
            (rec.mimeType || "").includes("mpeg") ? "mp3" :
            "webm";
          fd.append("file", blob, `recording.${ext}`);
          if (lang && lang.length === 2) fd.append("language", lang);
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { text?: string };
          const text = (data.text ?? "").trim();
          if (text) onTranscript(text);
          else setError("Didn't catch that.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setBusy("");
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mic access denied");
      stopStream();
    }
  }, [recording, busy, stopStream, onTranscript, lang]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    try { mediaRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
  }, [recording]);

  // Auto-play assistant reply as TTS when it changes.
  useEffect(() => {
    if (!autoSpeak || !speak || mutedTTS) return;
    const trimmed = speak.trim();
    if (!trimmed || trimmed === spokenRef.current) return;
    spokenRef.current = trimmed;

    let cancelled = false;
    (async () => {
      try {
        setBusy("speaking");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed, voice: "alloy" }),
        });
        if (!res.ok || !res.body) throw new Error(`TTS ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setBusy(""); URL.revokeObjectURL(url); };
        audio.onerror = () => { setBusy(""); URL.revokeObjectURL(url); };
        await audio.play().catch(() => setBusy(""));
      } catch (err) {
        setBusy("");
        setError(err instanceof Error ? err.message : "TTS failed");
      }
    })();
    return () => { cancelled = true; };
  }, [speak, autoSpeak, mutedTTS]);

  useEffect(() => () => {
    stopStream();
    audioRef.current?.pause();
  }, [stopStream]);

  const label =
    busy === "transcribing" ? t("transcribing") :
    busy === "speaking" ? t("speaking") :
    recording ? t("listening") : t("talkToTactix");

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="inline-flex items-center gap-1.5 rounded border border-danger/50 bg-danger/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-danger hover:bg-danger/20"
        >
          <Square className="size-3.5 fill-current" />
          {t("stop")}
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled || busy !== ""}
          title={label}
          className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40"
        >
          <Mic className="size-3.5" />
          {label}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setMutedTTS((m) => !m);
          audioRef.current?.pause();
          setBusy("");
        }}
        title={mutedTTS ? "Enable voice reply" : "Mute voice reply"}
        className="inline-flex items-center gap-1 rounded border border-border bg-surface/60 p-1.5 text-muted hover:text-foreground"
      >
        {mutedTTS ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
      {error && <span className="font-mono text-[10px] text-danger">{error}</span>}
    </div>
  );
}
