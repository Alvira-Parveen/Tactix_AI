import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Play, Pause, Loader2, Cpu } from "lucide-react";
import { TopNav } from "@/components/tactix/TopNav";
import { MatchProvider } from "@/lib/match-context";
import { getMatchDataset } from "@/lib/match-data";
import type { Detection } from "@/lib/wasm-yolo-types";
import { IoUTracker } from "@/lib/iou-tracker";

export const Route = createFileRoute("/cv/$matchId")({
  head: () => ({
    meta: [
      { title: "TACTIX CV — Browser YOLO player detection" },
      { name: "description", content: "Run YOLO player and ball detection directly in the browser via WebAssembly. No servers, no upload — the model runs on your machine." },
      { property: "og:title", content: "TACTIX CV — Browser YOLO" },
      { property: "og:description", content: "Real-time in-browser football player and ball detection with WebAssembly YOLO." },
    ],
  }),
  component: CVPage,
});

const DEFAULT_MODEL = "https://huggingface.co/onnx-community/yolov10n/resolve/main/onnx/model.onnx";

function CVPage() {
  const { matchId } = Route.useParams();
  const dataset = getMatchDataset(matchId);
  if (!dataset) {
    return (
      <div className="p-8 text-sm text-danger">
        Unknown match "{matchId}". <Link to="/" className="underline">Back to hub</Link>
      </div>
    );
  }

  return (
    <MatchProvider dataset={dataset}>
      <div className="min-h-screen bg-background text-foreground">
        <TopNav />
        <CVSurface />
      </div>
    </MatchProvider>
  );
}

function CVSurface() {
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [modelState, setModelState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(0.35);
  const [playerOnly, setPlayerOnly] = useState(true);

  const [source, setSource] = useState<"image" | "video" | null>(null);
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [counts, setCounts] = useState<{ people: number; ball: number; tracks: number }>({ people: 0, ball: 0, tracks: 0 });
  const trackerRef = useRef<IoUTracker>(new IoUTracker({ iouThresh: 0.25, maxAge: 20 }));

  const sessionRef = useRef<unknown>(null);
  const yoloRef = useRef<any>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const loadModel = useCallback(async () => {
    setError(null);
    setModelState("loading");
    setProgress(0);
    try {
      const mod = await import("@/lib/wasm-yolo-runtime");
      yoloRef.current = mod;
      const session = await mod.loadModel(modelUrl, (f) => setProgress(f));
      sessionRef.current = session;
      setModelState("ready");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Model load failed");
      setModelState("error");
    }
  }, [modelUrl]);

  const drawFrame = useCallback(async () => {
    if (!sessionRef.current || !yoloRef.current || !canvasRef.current) return;
    const yolo = yoloRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let src: HTMLImageElement | HTMLVideoElement | null = null;
    let w = 0, h = 0;
    if (source === "video" && videoRef.current) {
      src = videoRef.current;
      w = videoRef.current.videoWidth;
      h = videoRef.current.videoHeight;
    } else if (source === "image" && imgRef.current) {
      src = imgRef.current;
      w = imgRef.current.naturalWidth;
      h = imgRef.current.naturalHeight;
    }
    if (!src || !w || !h) return;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(src, 0, 0, w, h);

    const t0 = performance.now();
    const filter = playerOnly ? [0, 32] : undefined; // 0=person, 32=sports ball
    let dets: Detection[] = [];
    try {
      dets = await yolo.detect(sessionRef.current, src, w, h, threshold, filter);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Inference failed");
      setRunning(false);
      return;
    }
    yolo.drawDetections(ctx, dets);
    // Update the IoU tracker so bounding boxes carry stable IDs frame-to-frame.
    const tracked = trackerRef.current.update(dets);
    // Overlay track IDs above each detection.
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#22d3ee";
    for (const d of tracked) {
      ctx.fillText(`#${d.trackId}`, d.x + 2, Math.max(10, d.y - 2));
    }
    const dt = performance.now() - t0;
    setFps(dt > 0 ? 1000 / dt : 0);
    setCounts({
      people: dets.filter((d) => d.classId === 0).length,
      ball: dets.filter((d) => d.classId === 32).length,
      tracks: trackerRef.current.activeCount,
    });
  }, [source, threshold, playerOnly]);

  // Video processing loop.
  useEffect(() => {
    if (!running || source !== "video") return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (!busyRef.current && videoRef.current && !videoRef.current.paused) {
        busyRef.current = true;
        try { await drawFrame(); } finally { busyRef.current = false; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, source, drawFrame]);

  // Single-shot image detection.
  useEffect(() => {
    if (source === "image" && modelState === "ready" && imgRef.current) {
      drawFrame();
    }
  }, [source, modelState, threshold, playerOnly, drawFrame]);

  const onFile = (file: File) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      setSource("video");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.load();
        }
      });
    } else if (file.type.startsWith("image/")) {
      setSource("image");
      requestAnimationFrame(() => {
        if (imgRef.current) imgRef.current.src = url;
      });
    }
  };

  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setRunning(true);
    } else {
      videoRef.current.pause();
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-6">
      <header className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Computer Vision · Browser WASM</div>
        <h1 className="text-2xl font-bold tracking-tight">In-browser YOLO player detection</h1>
        <p className="mt-1 text-sm text-muted">
          Runs entirely on your device via WebAssembly (onnxruntime-web). Load a small YOLO ONNX model, drop in a clip, and see boxes on players + ball. No server, no upload.
        </p>
      </header>

      <section className="mb-4 grid gap-3 rounded border border-border bg-surface/30 p-4 md:grid-cols-[1fr_auto]">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted">YOLO ONNX model URL</label>
          <input
            type="text"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background/40 px-2 py-1 font-mono text-[11px]"
          />
          <p className="mt-1 font-mono text-[10px] text-muted">
            Default: YOLOv10n (~9 MB) from HuggingFace. YOLOv8-format ONNX (<code>[1, 84, N]</code>) and YOLOv10-format (<code>[1, N, 6]</code>) are both auto-detected.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={loadModel}
            disabled={modelState === "loading"}
            className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            {modelState === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Cpu className="size-3.5" />}
            {modelState === "ready" ? "Reload model" : modelState === "loading" ? `Loading ${(progress * 100).toFixed(0)}%` : "Load model"}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] text-danger">
          {error}
        </div>
      )}

      <section className="mb-4 flex flex-wrap items-center gap-4 rounded border border-border bg-surface/30 p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border bg-background/40 px-3 py-2 font-mono text-[11px] hover:border-primary/40">
          <Upload className="size-3.5" />
          Load image or video
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {source === "video" && (
          <button
            type="button"
            onClick={toggleVideo}
            disabled={modelState !== "ready"}
            className="inline-flex items-center gap-2 rounded border border-border bg-background/40 px-3 py-2 font-mono text-[11px] disabled:opacity-40"
          >
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {running ? "Pause" : "Play + detect"}
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Threshold</span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
          <span className="w-8 font-mono text-[11px]">{threshold.toFixed(2)}</span>
        </div>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <input type="checkbox" checked={playerOnly} onChange={(e) => setPlayerOnly(e.target.checked)} />
          Player + ball only
        </label>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted">
          <span>People: <span className="text-foreground">{counts.people}</span></span>
          <span>Ball: <span className="text-foreground">{counts.ball}</span></span>
          <span>Tracks: <span className="text-foreground">{counts.tracks}</span></span>
          <span>{fps > 0 ? `${fps.toFixed(1)} FPS` : "—"}</span>
        </div>
      </section>

      <section className="rounded border border-border bg-black/40 p-2">
        <div className="relative mx-auto max-w-full">
          <video
            ref={videoRef}
            className={`w-full ${source === "video" ? "block" : "hidden"}`}
            playsInline
            muted
            loop
            controls={false}
          />
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img ref={imgRef} className={`w-full ${source === "image" ? "block" : "hidden"}`} />
          <canvas
            ref={canvasRef}
            className={`absolute left-0 top-0 w-full ${source ? "block" : "hidden"}`}
          />
          {!source && (
            <div className="grid h-64 place-items-center font-mono text-[11px] text-muted">
              Load a clip or still to run detection
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 font-mono text-[10px] text-muted">
        Note: browser YOLO is a lightweight fallback. For real-time multi-object tracking (ByteTrack/DeepSORT), a Python microservice with a GPU is more accurate.
      </p>
    </main>
  );
}
