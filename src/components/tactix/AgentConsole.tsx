import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runAgents, type AgentReport } from "@/lib/agents.functions";
import { analyseFrameFn } from "@/lib/video.functions";
import type { PlayerBox, TrackedPlayer, VideoAnalysis } from "@/lib/agents/video";


export function AgentConsole({ matchId }: { matchId: string }) {
  const fn = useServerFn(runAgents);
  const { data, isLoading, error } = useQuery<AgentReport>({
    queryKey: ["agents", matchId],
    queryFn: () => fn({ data: { matchId, query: "" } }),
    staleTime: 30_000,
  });

  return (
    <section className="mt-14">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.9px", color: "#1c1c1c", lineHeight: 1.1 }}>
          Multi-agent console
        </h2>
        <span style={{ fontSize: 14, color: "#5f5f5d" }}>
          {isLoading ? "Running agents…" : data?.ok ? "6 agents · live" : "idle"}
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border p-5" style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8", color: "#7a1f1f" }}>
          Agents failed: {(error as Error).message}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AgentCard name="Tactical Analysis" status={data?.tactical ? "ok" : "idle"}>
            {data?.tactical ? (
              <ul className="space-y-1.5" style={{ fontSize: 13, color: "#1c1c1c" }}>
                <li>Home press · <b>{data.tactical.press.home}</b></li>
                <li>Away press · <b>{data.tactical.press.away}</b></li>
                <li>Territory · <b>{data.tactical.territory}</b></li>
                <li>Momentum · <b>{data.tactical.momentumPhase}</b></li>
                <li>xG/shot · {data.tactical.xGEfficiency.home} vs {data.tactical.xGEfficiency.away}</li>
              </ul>
            ) : <Skeleton />}
          </AgentCard>

          <AgentCard name="Prediction (Poisson)" status={data?.prediction ? "ok" : "idle"}>
            {data?.prediction ? (
              <div style={{ fontSize: 13, color: "#1c1c1c" }}>
                <div className="mb-2 flex gap-3">
                  <Pill label="Home" v={`${data.prediction.home}%`} />
                  <Pill label="Draw" v={`${data.prediction.draw}%`} />
                  <Pill label="Away" v={`${data.prediction.away}%`} />
                </div>
                <div style={{ color: "#5f5f5d" }}>
                  Next goal · H {data.prediction.nextGoal.home}% · A {data.prediction.nextGoal.away}% · none {data.prediction.nextGoal.none}%
                </div>
                <div className="mt-1" style={{ color: "#5f5f5d" }}>
                  Expected final · {data.prediction.expectedFinal.home} – {data.prediction.expectedFinal.away}
                </div>
              </div>
            ) : <Skeleton />}
          </AgentCard>

          <AgentCard name="Live Data" status={data?.live ? "ok" : "idle"}>
            {data?.live && data.live.length > 0 ? (
              <ul className="space-y-1" style={{ fontSize: 13, color: "#1c1c1c" }}>
                {data.live.slice(0, 5).map((ev, i) => (
                  <li key={i} className="truncate">
                    <b>{ev.type}</b>
                    {"minute" in ev ? ` · ${ev.minute}'` : ""}
                    {"scorer" in ev && ev.scorer ? ` · ${ev.scorer}` : ""}
                    {"player" in ev ? ` · ${ev.player}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13, color: "#5f5f5d" }}>No new events since snapshot.</div>
            )}
          </AgentCard>

          <AgentCard name="RAG (knowledge base)" status={data?.rag ? "ok" : "idle"}>
            {data?.rag && data.rag.hits.length > 0 ? (
              <ul className="space-y-1.5" style={{ fontSize: 13, color: "#1c1c1c" }}>
                {data.rag.hits.map((h) => (
                  <li key={h.id}>
                    <b>{h.title}</b>
                    <span style={{ color: "#5f5f5d" }}> · score {h.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13, color: "#5f5f5d" }}>No matching passages.</div>
            )}
          </AgentCard>

          <AgentCard name="Visualization" status={data?.visualization ? "ok" : "idle"}>
            {data?.visualization ? (
              <ul className="space-y-1" style={{ fontSize: 13, color: "#1c1c1c" }}>
                {data.visualization.dashboard.map((d) => (
                  <li key={d.id}>
                    <span style={{ color: "#5f5f5d" }}>{d.label}</span> · <b>{d.value}</b>
                  </li>
                ))}
                <li style={{ color: "#5f5f5d" }}>
                  Heatmap · {data.visualization.shotHeatmap.cells.length} cells
                </li>
              </ul>
            ) : <Skeleton />}
          </AgentCard>

          <VideoAnalysisCard />

        </div>
      )}
    </section>
  );
}

function AgentCard({ name, status, children }: { name: string; status: "ok" | "idle" | "offline"; children: React.ReactNode }) {
  const dot =
    status === "ok" ? "#2b558f" : status === "offline" ? "#7a1f1f" : "#5f5f5d";
  return (
    <div
      tabIndex={0}
      className="group relative overflow-hidden rounded-xl border p-5 transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-[#d9d5c9] hover:bg-white hover:shadow-[0_20px_40px_-24px_rgba(28,28,28,0.35),0_2px_6px_-2px_rgba(28,28,28,0.15)] focus-visible:-translate-y-1 focus-visible:border-[#c9c3b3] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(43,85,143,0.35),0_20px_40px_-24px_rgba(28,28,28,0.35)] active:translate-y-0"
      style={{ borderColor: "#eceae4", backgroundColor: "#fcfbf8" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[300%] group-hover:opacity-100"
      />
      <div className="relative mb-3 flex items-center gap-2">
        <span
          className="inline-block size-1.5 rounded-full transition-transform duration-300 group-hover:scale-125"
          style={{ backgroundColor: dot }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1c", letterSpacing: "0.02em", textTransform: "uppercase" }}>
          {name}
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({ label, v }: { label: string; v: string }) {
  return (
    <span className="rounded-md border px-2 py-0.5" style={{ borderColor: "#eceae4", fontSize: 12 }}>
      <span style={{ color: "#5f5f5d" }}>{label} </span>
      <b style={{ color: "#1c1c1c" }}>{v}</b>
    </span>
  );
}

function Skeleton() {
  return <div className="h-16 animate-pulse rounded-md" style={{ backgroundColor: "rgba(28,28,28,0.05)" }} />;
}

function VideoAnalysisCard() {
  const fn = useServerFn(analyseFrameFn);
  const [previewImgs, setPreviewImgs] = useState<string[]>([]);
  const [sourceKind, setSourceKind] = useState<"image" | "video" | null>(null);
  const [result, setResult] = useState<VideoAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const trajectorySvgRef = useRef<SVGSVGElement | null>(null);
  const frameRefs = useRef<Record<number, HTMLDivElement | null>>({});

  async function extractFramesFromVideo(file: File): Promise<string[]> {
    // Sample 5 frames spread across the clip. Wide-angle frames give
    // formation/shape; close-ups give phase/press. The model uses them together.
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Browser can't decode this video file"));
      });

      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const stops = [0.1, 0.3, 0.5, 0.7, 0.9].map((p) =>
        Math.min(Math.max(dur * p, 0.05), Math.max(dur - 0.05, 0.05)),
      );

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const maxW = 960; // smaller per-frame — we ship up to 5.
      const scale = w > maxW ? maxW / w : 1;
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      const frames: string[] = [];
      for (const t of stops) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("Failed to seek video"));
          video.currentTime = t;
        });
        ctx.drawImage(video, 0, 0, cw, ch);
        frames.push(canvas.toDataURL("image/jpeg", 0.78));
      }
      return frames;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onPick(file: File | null) {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setErr("Upload an image or a video file.");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setErr("File too large (max 80MB).");
      return;
    }
    setErr(null);
    setResult(null);
    setBusy(true);
    setSourceKind(isVideo ? "video" : "image");
    try {
      let frames: string[];
      if (isVideo) {
        setStatus("Sampling frames across clip…");
        frames = await extractFramesFromVideo(file);
      } else {
        setStatus("Reading image…");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error("Read failed"));
          r.readAsDataURL(file);
        });
        frames = [dataUrl];
      }
      setPreviewImgs(frames);
      setStatus(`Analysing ${frames.length} frame${frames.length === 1 ? "" : "s"}…`);
      const res = await fn({ data: { imageDataUrls: frames } });
      setResult(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStatus("");
      setBusy(false);
    }
  }

  const ok = result?.supported === true;
  const cardStatus: "ok" | "idle" | "offline" = busy ? "idle" : ok ? "ok" : result ? "offline" : "idle";

  return (
    <AgentCard name="Video Analysis (vision)" status={cardStatus}>
      <div className="space-y-3" style={{ fontSize: 13, color: "#1c1c1c" }}>
        <label
          className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2"
          style={{ borderColor: "#eceae4", backgroundColor: "#fff", fontSize: 12, color: "#1c1c1c" }}
        >
          <input
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          {busy ? status || "Working…" : previewImgs.length > 0 ? "Choose another clip or frame" : "Upload a clip (mp4/webm) or frame"}
        </label>

        {previewImgs.length > 0 && (
          <div className={previewImgs.length > 1 ? "grid grid-cols-3 gap-1.5" : "relative"}>
            {previewImgs.map((src, i) => {
              const frameIdx = i + 1;
              const moment = result?.supported === true
                ? result.moments.find((m) => m.index === frameIdx)
                : undefined;
              const boxes = moment?.boxes ?? [];
              const playerMap = result?.supported === true
                ? new Map(result.players.map((p) => [p.id, p]))
                : new Map<string, TrackedPlayer>();
              const teamHome = result?.supported === true ? result.teamHome : "home";
              const teamAway = result?.supported === true ? result.teamAway : "away";
              return (
                <div
                  key={i}
                  className="relative"
                  ref={(el) => { frameRefs.current[frameIdx] = el; }}
                >
                  <img
                    src={src}
                    alt={`frame ${frameIdx}`}
                    className="w-full rounded-md border block"
                    style={{ borderColor: "#eceae4", maxHeight: previewImgs.length > 1 ? 80 : 160, objectFit: "cover" }}
                  />
                  {boxes.length > 0 && (
                    <FrameOverlay boxes={boxes} playerMap={playerMap} teamHome={teamHome} teamAway={teamAway} />
                  )}
                  {sourceKind === "video" && (
                    <span
                      className="absolute left-1 top-1 rounded px-1 py-0.5"
                      style={{ fontSize: 9, backgroundColor: "rgba(28,28,28,0.75)", color: "#fff", letterSpacing: "0.04em", zIndex: 2 }}
                    >
                      {previewImgs.length > 1 ? `F${frameIdx}` : "KEY FRAME"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {err && <div style={{ color: "#7a1f1f" }}>{err}</div>}

        {result?.supported === true && (
          <ExportToolbar
            result={result}
            previewImgs={previewImgs}
            trajectorySvgRef={trajectorySvgRef}
            frameRefs={frameRefs}
          />
        )}

        {result?.supported === true && (
          <div className="space-y-3">
            <ul className="space-y-1">
              <li>Match · <b>{result.teamHome}</b> vs <b>{result.teamAway}</b></li>
              <li>
                Formation · <b>{result.formationHome}</b> vs <b>{result.formationAway}</b>
                <span style={{ fontSize: 10, color: "#5f5f5d", marginLeft: 6 }}>
                  confidence {result.formationConfidence}
                </span>
              </li>
              <li>Phase · <b>{result.phase}</b> · ball {result.ballZone}</li>
              <li>Press · <b>{result.pressIntensity}</b></li>
              <li style={{ color: "#5f5f5d" }}>{result.shape}</li>
              {result.keyObservations.slice(0, 4).map((o, i) => (
                <li key={i} style={{ color: "#5f5f5d" }}>• {o}</li>
              ))}
              <li className="pt-1"><i>{result.coachNote}</i></li>
            </ul>

            {result.players.length > 0 && (
              <div className="space-y-1 pt-1">
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#1c1c1c" }}>
                  Tracked players · {result.players.length}
                </div>
                <ul className="space-y-1">
                  {result.players.map((p) => {
                    const team = p.team === "home" ? result.teamHome : p.team === "away" ? result.teamAway : "unknown";
                    return (
                      <li key={p.id} style={{ fontSize: 12, color: "#1c1c1c" }}>
                        <b>{p.id}</b> · #{p.number} {p.role} · {team}
                        {p.framesSeen.length > 0 && (
                          <span style={{ color: "#5f5f5d" }}> · frames {p.framesSeen.join(",")}</span>
                        )}
                        {p.note && <div style={{ fontSize: 11, color: "#5f5f5d" }}>{p.note}</div>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <TrajectoryPanel result={result} svgRef={trajectorySvgRef} />
            <HeatmapPanel result={result} />



            {result.moments.length > 0 && (
              <div className="space-y-2 pt-1">
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#1c1c1c" }}>
                  Tactical timeline · {result.moments.length} moments
                </div>
                <ol className="space-y-2">
                  {result.moments.map((m) => (
                    <li
                      key={m.index}
                      className="rounded-md border p-2"
                      style={{ borderColor: "#eceae4", backgroundColor: "#fff" }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <b style={{ fontSize: 12 }}>#{m.index} · {m.label}</b>
                        <span style={{ fontSize: 10, color: "#5f5f5d" }}>{m.phase} · {m.ballZone} · press {m.pressIntensity}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#1c1c1c", marginTop: 2 }}>
                        <b>Event</b> · {m.event}
                      </div>
                      {m.pressTrigger && m.pressTrigger !== "n/a" && (
                        <div style={{ fontSize: 12, color: "#1c1c1c" }}>
                          <b>Trigger</b> · {m.pressTrigger}
                        </div>
                      )}
                      {m.players.length > 0 && (
                        <div style={{ fontSize: 12, color: "#5f5f5d" }}>Players · {m.players.join(", ")}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#5f5f5d", marginTop: 2 }}>{m.note}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {result?.supported === false && (
          <div style={{ color: "#5f5f5d" }}>{result.reason}</div>
        )}

        {!result && !busy && (
          <div style={{ color: "#5f5f5d" }}>
            Upload an .mp4 clip or a still — we grab a key frame and read formation, shape, and press.
          </div>
        )}
      </div>
    </AgentCard>
  );

}

function playerColor(p: TrackedPlayer | undefined, id: string): string {
  const team = p?.team ?? (id.startsWith("A") ? "away" : id.startsWith("H") ? "home" : "unknown");
  return team === "away" ? "#c14a2b" : team === "home" ? "#1d4ed8" : "#5f5f5d";
}

type TooltipState = {
  x: number; // client px within container
  y: number;
  playerId: string;
  team: string;
  role: string;
  number: string | number;
  hasBall: boolean;
  color: string;
};

function FrameOverlay({
  boxes,
  playerMap,
  teamHome,
  teamAway,
}: {
  boxes: PlayerBox[];
  playerMap: Map<string, TrackedPlayer>;
  teamHome: string;
  teamAway: string;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function handleEnter(e: React.MouseEvent, b: PlayerBox) {
    const p = playerMap.get(b.playerId);
    const rect = wrapRef.current?.getBoundingClientRect();
    const teamLabel = p?.team === "home" ? teamHome : p?.team === "away" ? teamAway : "unknown";
    setTip({
      x: rect ? e.clientX - rect.left : 0,
      y: rect ? e.clientY - rect.top : 0,
      playerId: b.playerId,
      team: teamLabel,
      role: p?.role ?? "—",
      number: p?.number ?? "—",
      hasBall: !!b.hasBall,
      color: playerColor(p, b.playerId),
    });
  }
  function handleMove(e: React.MouseEvent) {
    if (!tip) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ ...tip, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ zIndex: 1 }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {boxes.map((b, i) => {
          const p = playerMap.get(b.playerId);
          const color = playerColor(p, b.playerId);
          return (
            <g key={`${b.playerId}-${i}`}>
              <rect
                x={b.x * 100}
                y={b.y * 100}
                width={b.w * 100}
                height={b.h * 100}
                fill="transparent"
                stroke={color}
                strokeWidth={b.hasBall ? 1.4 : 0.6}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => handleEnter(e, b)}
                onMouseMove={handleMove}
                onMouseLeave={() => setTip(null)}
              />
              <rect
                x={b.x * 100}
                y={Math.max(0, b.y * 100 - 5)}
                width={Math.max(6, b.playerId.length * 2.4)}
                height={5}
                fill={color}
                opacity={0.9}
                pointerEvents="none"
              />
              <text
                x={b.x * 100 + 1}
                y={Math.max(0, b.y * 100 - 1.2)}
                fill="#fff"
                style={{ fontSize: 3.2, fontWeight: 700, fontFamily: "ui-sans-serif, system-ui" }}
                pointerEvents="none"
              >
                {b.playerId}
                {b.hasBall ? " ●" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute rounded-md px-2 py-1 shadow"
          style={{
            left: Math.min(tip.x + 8, 260),
            top: Math.max(tip.y - 44, 0),
            backgroundColor: "rgba(28,28,28,0.92)",
            color: "#fff",
            fontSize: 10,
            lineHeight: 1.35,
            zIndex: 3,
            whiteSpace: "nowrap",
            borderLeft: `3px solid ${tip.color}`,
          }}
        >
          <div style={{ fontWeight: 700 }}>{tip.playerId} · #{tip.number}</div>
          <div>{tip.team} · {tip.role}</div>
          <div>{tip.hasBall ? "● in possession" : "no ball"}</div>
        </div>
      )}
    </div>
  );
}

function TrajectoryPanel({ result, svgRef }: { result: Extract<VideoAnalysis, { supported: true }>; svgRef?: React.MutableRefObject<SVGSVGElement | null> }) {
  // Build per-player centroid trails from moments (ordered by index).
  const trails = new Map<string, { x: number; y: number; frame: number }[]>();
  const sortedMoments = [...result.moments].sort((a, b) => a.index - b.index);
  for (const m of sortedMoments) {
    for (const b of m.boxes) {
      const arr = trails.get(b.playerId) ?? [];
      arr.push({ x: b.cx, y: b.cy, frame: m.index });
      trails.set(b.playerId, arr);
    }
  }
  const entries = Array.from(trails.entries()).filter(([, pts]) => pts.length >= 1);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-2" style={{ borderColor: "#eceae4", fontSize: 12, color: "#5f5f5d" }}>
        Trajectories · no bounding-box data returned this run (model may be zoomed-in). Try a wider clip.
      </div>
    );
  }
  const playerMap = new Map(result.players.map((p) => [p.id, p]));

  return (
    <div className="space-y-2 pt-1">
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#1c1c1c" }}>
        Player trajectories · {entries.length} tracks across {sortedMoments.length} moments
      </div>
      <div
        className="rounded-md border p-2"
        style={{ borderColor: "#eceae4", backgroundColor: "#f6f5ef" }}
      >
        <svg ref={svgRef} viewBox="0 0 100 62" preserveAspectRatio="none" style={{ width: "100%", height: 200 }} xmlns="http://www.w3.org/2000/svg">
          {/* pitch frame */}
          <rect x={1} y={1} width={98} height={60} fill="#e9ecd7" stroke="#b8bda0" strokeWidth={0.3} />
          <line x1={50} y1={1} x2={50} y2={61} stroke="#b8bda0" strokeWidth={0.3} />
          <circle cx={50} cy={31} r={6} fill="none" stroke="#b8bda0" strokeWidth={0.3} />
          <rect x={1} y={16} width={12} height={30} fill="none" stroke="#b8bda0" strokeWidth={0.3} />
          <rect x={87} y={16} width={12} height={30} fill="none" stroke="#b8bda0" strokeWidth={0.3} />

          {entries.map(([pid, pts]) => {
            const p = playerMap.get(pid);
            const color = playerColor(p, pid);
            const scaled = pts.map((pt) => ({ x: pt.x * 98 + 1, y: pt.y * 60 + 1 }));
            const path = scaled.map((s, i) => `${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(" ");
            return (
              <g key={pid}>
                {scaled.length > 1 && (
                  <path d={path} fill="none" stroke={color} strokeWidth={0.6} opacity={0.75} />
                )}
                {scaled.map((s, i) => (
                  <circle key={i} cx={s.x} cy={s.y} r={i === scaled.length - 1 ? 1.2 : 0.7} fill={color} />
                ))}
                {scaled.length > 0 && (
                  <text
                    x={scaled[scaled.length - 1].x + 1.2}
                    y={scaled[scaled.length - 1].y - 0.8}
                    fill={color}
                    style={{ fontSize: 2.4, fontWeight: 700 }}
                  >
                    {pid}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-2 pt-1" style={{ fontSize: 10, color: "#5f5f5d" }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, backgroundColor: "#1d4ed8", marginRight: 3 }} />{result.teamHome}</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, backgroundColor: "#c14a2b", marginRight: 3 }} />{result.teamAway}</span>
          <span>· dot size grows at latest frame · dots-only tracks = single detection</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Heatmap ----------------

function HeatmapPanel({ result }: { result: Extract<VideoAnalysis, { supported: true }> }) {
  const players = result.players;
  const [selected, setSelected] = useState<string>("__all__");

  // Collect all centroids by player id
  const byPlayer = useMemo(() => {
    const m = new Map<string, { cx: number; cy: number }[]>();
    for (const mo of result.moments) {
      for (const b of mo.boxes) {
        const arr = m.get(b.playerId) ?? [];
        arr.push({ cx: b.cx, cy: b.cy });
        m.set(b.playerId, arr);
      }
    }
    return m;
  }, [result]);

  const points = useMemo(() => {
    if (selected === "__all__") {
      return Array.from(byPlayer.values()).flat();
    }
    return byPlayer.get(selected) ?? [];
  }, [byPlayer, selected]);

  // 12 x 8 grid density
  const COLS = 12;
  const ROWS = 8;
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (const p of points) {
      const c = Math.min(COLS - 1, Math.max(0, Math.floor(p.cx * COLS)));
      const r = Math.min(ROWS - 1, Math.max(0, Math.floor(p.cy * ROWS)));
      g[r][c] += 1;
    }
    return g;
  }, [points]);

  const max = Math.max(1, ...grid.flat());
  const cellW = 100 / COLS;
  const cellH = 62 / ROWS;

  const selectedPlayer = selected === "__all__" ? undefined : players.find((p) => p.id === selected);
  const heatColor = selectedPlayer ? playerColor(selectedPlayer, selectedPlayer.id) : "#1c1c1c";

  if (byPlayer.size === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#1c1c1c" }}>
          Heatmap density
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border px-1.5 py-0.5"
          style={{ borderColor: "#eceae4", fontSize: 11, backgroundColor: "#fff", color: "#1c1c1c" }}
        >
          <option value="__all__">All players</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} · #{p.number} · {p.role}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-md border p-2" style={{ borderColor: "#eceae4", backgroundColor: "#f6f5ef" }}>
        <svg viewBox="0 0 100 62" preserveAspectRatio="none" style={{ width: "100%", height: 160 }}>
          <rect x={1} y={1} width={98} height={60} fill="#e9ecd7" stroke="#b8bda0" strokeWidth={0.3} />
          {grid.map((row, r) =>
            row.map((v, c) => {
              if (v === 0) return null;
              const a = Math.min(0.85, 0.15 + (v / max) * 0.7);
              return (
                <rect
                  key={`${r}-${c}`}
                  x={c * cellW}
                  y={r * cellH}
                  width={cellW}
                  height={cellH}
                  fill={heatColor}
                  opacity={a}
                />
              );
            }),
          )}
          <line x1={50} y1={1} x2={50} y2={61} stroke="#b8bda0" strokeWidth={0.3} />
          <circle cx={50} cy={31} r={6} fill="none" stroke="#b8bda0" strokeWidth={0.3} />
          <rect x={1} y={16} width={12} height={30} fill="none" stroke="#b8bda0" strokeWidth={0.3} />
          <rect x={87} y={16} width={12} height={30} fill="none" stroke="#b8bda0" strokeWidth={0.3} />
        </svg>
        <div style={{ fontSize: 10, color: "#5f5f5d" }}>
          {points.length} centroid{points.length === 1 ? "" : "s"} across {result.moments.length} moments · darker = more time
        </div>
      </div>
    </div>
  );
}

// ---------------- Export ----------------

function ExportToolbar({
  result,
  previewImgs,
  trajectorySvgRef,
  frameRefs,
}: {
  result: Extract<VideoAnalysis, { supported: true }>;
  previewImgs: string[];
  trajectorySvgRef: React.MutableRefObject<SVGSVGElement | null>;
  frameRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
}) {
  const [busy, setBusy] = useState<null | "json" | "png" | "pdf">(null);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      match: { home: result.teamHome, away: result.teamAway },
      formation: {
        home: result.formationHome,
        away: result.formationAway,
        confidence: result.formationConfidence,
      },
      phase: result.phase,
      ballZone: result.ballZone,
      pressIntensity: result.pressIntensity,
      shape: result.shape,
      keyObservations: result.keyObservations,
      coachNote: result.coachNote,
      players: result.players,
      moments: result.moments,
      frames: previewImgs, // data URLs of the 5 sampled frames
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `tactix-analysis-${Date.now()}.json`);
  }

  async function svgToPngDataUrl(svg: SVGSVGElement, width: number, height: number): Promise<string> {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("svg load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.fillStyle = "#fcfbf8";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadImage(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("img load failed"));
      img.src = src;
    });
    return img;
  }

  // Compose PNG: header + 5 frames with overlay boxes + trajectory panel
  async function buildCompositePng(): Promise<string> {
    const W = 1400;
    const framesPerRow = Math.min(5, previewImgs.length);
    const frameW = Math.floor((W - 40 - (framesPerRow - 1) * 12) / framesPerRow);
    const frameH = Math.round(frameW * 0.56);
    const headerH = 90;
    const trajH = 420;
    const H = headerH + frameH + 24 + trajH + 40;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");

    ctx.fillStyle = "#fcfbf8";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1c1c1c";
    ctx.font = "600 26px ui-sans-serif, system-ui";
    ctx.fillText(`${result.teamHome} vs ${result.teamAway}`, 20, 34);
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillStyle = "#5f5f5d";
    ctx.fillText(
      `Formation ${result.formationHome} vs ${result.formationAway} · ${result.phase} · ball ${result.ballZone} · press ${result.pressIntensity}`,
      20,
      56,
    );
    ctx.fillText(`Confidence ${result.formationConfidence} · ${result.players.length} tracked players`, 20, 74);

    // frames with overlays
    for (let i = 0; i < previewImgs.length; i++) {
      const x = 20 + i * (frameW + 12);
      const y = headerH;
      try {
        const img = await loadImage(previewImgs[i]);
        ctx.drawImage(img, x, y, frameW, frameH);
      } catch {
        ctx.fillStyle = "#eee";
        ctx.fillRect(x, y, frameW, frameH);
      }
      const moment = result.moments.find((m) => m.index === i + 1);
      const playerMap = new Map(result.players.map((p) => [p.id, p]));
      if (moment) {
        for (const b of moment.boxes) {
          const p = playerMap.get(b.playerId);
          const color = playerColor(p, b.playerId);
          ctx.strokeStyle = color;
          ctx.lineWidth = b.hasBall ? 2.5 : 1.2;
          ctx.strokeRect(x + b.x * frameW, y + b.y * frameH, b.w * frameW, b.h * frameH);
          ctx.fillStyle = color;
          const labelW = Math.max(28, b.playerId.length * 8);
          ctx.fillRect(x + b.x * frameW, y + b.y * frameH - 14, labelW, 14);
          ctx.fillStyle = "#fff";
          ctx.font = "700 10px ui-sans-serif, system-ui";
          ctx.fillText(b.playerId + (b.hasBall ? " ●" : ""), x + b.x * frameW + 3, y + b.y * frameH - 3);
        }
      }
      ctx.fillStyle = "rgba(28,28,28,0.75)";
      ctx.fillRect(x + 4, y + 4, 34, 16);
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px ui-sans-serif, system-ui";
      ctx.fillText(`F${i + 1}`, x + 10, y + 15);
    }

    // trajectory svg
    if (trajectorySvgRef.current) {
      try {
        const trajPng = await svgToPngDataUrl(trajectorySvgRef.current, W - 40, trajH);
        const img = await loadImage(trajPng);
        ctx.drawImage(img, 20, headerH + frameH + 24, W - 40, trajH);
      } catch {
        /* ignore */
      }
    }

    return canvas.toDataURL("image/png");
  }

  async function exportPNG() {
    setBusy("png");
    try {
      const png = await buildCompositePng();
      const blob = await (await fetch(png)).blob();
      downloadBlob(blob, `tactix-analysis-${Date.now()}.png`);
    } catch (e) {
      alert("PNG export failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportPDF() {
    setBusy("pdf");
    try {
      const png = await buildCompositePng();
      const img = await loadImage(png);
      // Re-encode to JPEG for spec-compliant /DCTDecode embedding.
      const jpegCanvas = document.createElement("canvas");
      jpegCanvas.width = img.width;
      jpegCanvas.height = img.height;
      const jctx = jpegCanvas.getContext("2d");
      if (!jctx) throw new Error("no ctx");
      jctx.fillStyle = "#ffffff";
      jctx.fillRect(0, 0, img.width, img.height);
      jctx.drawImage(img, 0, 0);
      const jpegDataUrl = jpegCanvas.toDataURL("image/jpeg", 0.9);
      const pdf = buildSimplePdf(jpegDataUrl, img.width, img.height, img.width, img.height);
      downloadBlob(pdf, `tactix-analysis-${Date.now()}.pdf`);
    } catch (e) {
      alert("PDF export failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        onClick={exportJSON}
        disabled={busy !== null}
        className="rounded-md border px-2.5 py-1"
        style={{ borderColor: "#eceae4", backgroundColor: "#fff", fontSize: 11, color: "#1c1c1c", cursor: busy ? "wait" : "pointer" }}
      >
        Export JSON
      </button>
      <button
        onClick={exportPNG}
        disabled={busy !== null}
        className="rounded-md border px-2.5 py-1"
        style={{ borderColor: "#eceae4", backgroundColor: "#fff", fontSize: 11, color: "#1c1c1c", cursor: busy ? "wait" : "pointer" }}
      >
        {busy === "png" ? "Rendering…" : "Export PNG"}
      </button>
      <button
        onClick={exportPDF}
        disabled={busy !== null}
        className="rounded-md border px-2.5 py-1"
        style={{ borderColor: "#eceae4", backgroundColor: "#fff", fontSize: 11, color: "#1c1c1c", cursor: busy ? "wait" : "pointer" }}
      >
        {busy === "pdf" ? "Rendering…" : "Export PDF"}
      </button>
      <span style={{ fontSize: 10, color: "#5f5f5d", alignSelf: "center" }}>
        JSON includes players, moments, boxes & frame images · PNG/PDF renders overlays + trajectories
      </span>
    </div>
  );
}

// Build a minimal 1-page PDF embedding a JPEG (spec-compliant /DCTDecode).
function buildSimplePdf(jpegDataUrl: string, imgW: number, imgH: number, pageW: number, pageH: number): Blob {
  const b64 = jpegDataUrl.split(",")[1] ?? "";
  const raw = atob(b64);
  const jpegBytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) jpegBytes[i] = raw.charCodeAt(i);

  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  function push(s: string | Uint8Array) {
    const bytes = typeof s === "string" ? enc.encode(s) : s;
    // Copy to a fresh ArrayBuffer-backed Uint8Array to satisfy strict BlobPart typing.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    parts.push(copy);
    cursor += copy.length;
  }
  function startObj(n: number) {
    offsets[n] = cursor;
    push(`${n} 0 obj\n`);
  }
  function endObj() {
    push(`\nendobj\n`);
  }

  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  startObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  startObj(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  endObj();

  startObj(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
  );
  endObj();

  startObj(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  push(jpegBytes);
  push(`\nendstream`);
  endObj();

  const stream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  startObj(5);
  push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  endObj();

  const xrefStart = cursor;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

