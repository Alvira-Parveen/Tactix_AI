// Browser-side YOLO inference via onnxruntime-web.
// Client-only. Do NOT import this from server code.
// We lazy-load `onnxruntime-web` at call time so SSR never evaluates its
// browser-only module globals.
type OrtModule = typeof import("onnxruntime-web");
type InferenceSession = import("onnxruntime-web").InferenceSession;
type Tensor = import("onnxruntime-web").Tensor;

let ortPromise: Promise<OrtModule> | null = null;
async function getOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web").then((mod) => {
      mod.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
      return mod;
    });
  }
  return ortPromise;
}

export type Detection = {
  x: number; y: number; w: number; h: number; // pixel coords on the source image
  score: number;
  classId: number;
  label: string;
};

// COCO class names (YOLOv5/v8 default order). Player = "person", Ball = "sports ball".
export const COCO_CLASSES = [
  "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
  "fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
  "elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
  "skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard",
  "tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
  "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch",
  "potted plant","bed","dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone",
  "microwave","oven","toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear",
  "hair drier","toothbrush",
];

// Default: YOLOv8n exported to ONNX (community mirror on HuggingFace).
// Users can override in the UI.
export const DEFAULT_MODEL_URL =
  "https://huggingface.co/Xenova/yolov8n/resolve/main/onnx/model.onnx";

const INPUT_SIZE = 640;

let sessionCache: { url: string; session: InferenceSession } | null = null;

export async function loadModel(
  url: string = DEFAULT_MODEL_URL,
  onProgress?: (frac: number) => void,
): Promise<InferenceSession> {
  const ort = await getOrt();
  if (sessionCache && sessionCache.url === url) return sessionCache.session;

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Model fetch failed: ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? "0");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (onProgress && total) onProgress(received / total);
    }
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }

  const session = await ort.InferenceSession.create(buf.buffer, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  sessionCache = { url, session };
  return session;
}

/** Draw an image element into a 640x640 letterboxed CHW float32 tensor (0..1 RGB). */
function preprocess(
  ort: OrtModule,
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  srcW: number,
  srcH: number,
): { tensor: Tensor; scale: number; padX: number; padY: number } {
  const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const padX = Math.floor((INPUT_SIZE - newW) / 2);
  const padY = Math.floor((INPUT_SIZE - newH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(114,114,114)"; // YOLO letterbox gray
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(source, padX, padY, newW, newH);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    chw[p] = data[i] / 255;
    chw[p + plane] = data[i + 1] / 255;
    chw[p + 2 * plane] = data[i + 2] / 255;
  }
  const tensor = new ort.Tensor("float32", chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  return { tensor, scale, padX, padY };
}

function iou(a: Detection, b: Detection) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function nms(dets: Detection[], iouThresh = 0.45): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const d of sorted) {
    if (keep.every((k) => k.classId !== d.classId || iou(k, d) < iouThresh)) keep.push(d);
  }
  return keep;
}

/**
 * Run one detection pass. Assumes YOLOv8 export with output shape [1, 84, 8400]
 * (4 box coords + 80 class scores).
 */
export async function detect(
  session: InferenceSession,
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  srcW: number,
  srcH: number,
  scoreThresh = 0.35,
  classFilter?: number[],
): Promise<Detection[]> {
  const ort = await getOrt();
  const { tensor, scale, padX, padY } = preprocess(ort, source, srcW, srcH);
  const inputName = session.inputNames[0];
  const outputMap = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames[0];
  const out = outputMap[outputName];
  const data = out.data as Float32Array;
  const dims = out.dims;

  const detections: Detection[] = [];
  const pushDet = (x0: number, y0: number, bw: number, bh: number, score: number, cls: number) => {
    if (score < scoreThresh) return;
    if (classFilter && !classFilter.includes(cls)) return;
    detections.push({
      x: Math.max(0, x0),
      y: Math.max(0, y0),
      w: Math.min(srcW, bw),
      h: Math.min(srcH, bh),
      score,
      classId: cls,
      label: COCO_CLASSES[cls] ?? `class_${cls}`,
    });
  };

  // YOLOv10 export: [1, N, 6] where each row is [x1, y1, x2, y2, score, class].
  // NMS is already applied inside the model.
  if (dims.length === 3 && dims[2] === 6) {
    const n = dims[1];
    for (let i = 0; i < n; i++) {
      const off = i * 6;
      const x1 = data[off], y1 = data[off + 1], x2 = data[off + 2], y2 = data[off + 3];
      const score = data[off + 4];
      const cls = data[off + 5] | 0;
      pushDet(
        (x1 - padX) / scale,
        (y1 - padY) / scale,
        (x2 - x1) / scale,
        (y2 - y1) / scale,
        score,
        cls,
      );
    }
    return detections;
  }

  // YOLOv8 export: [1, 84, N] — 4 box coords + 80 class scores per anchor.
  const channels = dims[1];
  const num = dims[2];
  const numClasses = channels - 4;
  for (let i = 0; i < num; i++) {
    const cx = data[0 * num + i];
    const cy = data[1 * num + i];
    const w = data[2 * num + i];
    const h = data[3 * num + i];
    let bestScore = 0;
    let bestClass = -1;
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * num + i];
      if (s > bestScore) { bestScore = s; bestClass = c; }
    }
    if (bestClass < 0) continue;
    pushDet(
      (cx - w / 2 - padX) / scale,
      (cy - h / 2 - padY) / scale,
      w / scale,
      h / scale,
      bestScore,
      bestClass,
    );
  }
  return nms(detections);
}

export function drawDetections(
  ctx: CanvasRenderingContext2D,
  dets: Detection[],
) {
  ctx.lineWidth = 2;
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  for (const d of dets) {
    const color = d.label === "person" ? "#22d3ee" : d.label === "sports ball" ? "#facc15" : "#a78bfa";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    const tag = `${d.label} ${(d.score * 100).toFixed(0)}%`;
    const tw = ctx.measureText(tag).width + 6;
    ctx.fillRect(d.x, Math.max(0, d.y - 14), tw, 14);
    ctx.fillStyle = "#000";
    ctx.fillText(tag, d.x + 3, Math.max(0, d.y - 13));
  }
}
