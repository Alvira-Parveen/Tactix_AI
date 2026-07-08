// Lightweight IoU-based multi-object tracker (SORT-lite).
// Runs frame-to-frame association between YOLO detections and existing tracks
// using greedy IoU matching. Not a full ByteTrack/DeepSORT, but sufficient for
// short football clips at 5-15 fps in-browser.
import type { Detection, TrackedDetection } from "./wasm-yolo-types";

type Track = {
  id: number;
  bbox: [number, number, number, number]; // x, y, w, h
  classId: number;
  label: string;
  score: number;
  hits: number;
  age: number; // frames since last match
};

function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

export class IoUTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly iouThresh: number;
  private readonly maxAge: number;

  constructor(opts: { iouThresh?: number; maxAge?: number } = {}) {
    this.iouThresh = opts.iouThresh ?? 0.3;
    this.maxAge = opts.maxAge ?? 15;
  }

  update(detections: Detection[]): TrackedDetection[] {
    // Age all existing tracks by one frame.
    for (const t of this.tracks) t.age += 1;

    const assigned = new Set<number>();
    const out: TrackedDetection[] = [];

    // Greedy matching: for each detection, find the best-IoU track of the
    // same class that isn't taken yet.
    for (const d of detections) {
      let bestIdx = -1;
      let bestIou = this.iouThresh;
      for (let i = 0; i < this.tracks.length; i++) {
        if (assigned.has(i)) continue;
        const t = this.tracks[i];
        if (t.classId !== d.classId) continue;
        const s = iou([d.x, d.y, d.w, d.h], t.bbox);
        if (s > bestIou) {
          bestIou = s;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const t = this.tracks[bestIdx];
        t.bbox = [d.x, d.y, d.w, d.h];
        t.score = d.score;
        t.hits += 1;
        t.age = 0;
        assigned.add(bestIdx);
        out.push({ ...d, trackId: t.id });
      } else {
        const newTrack: Track = {
          id: this.nextId++,
          bbox: [d.x, d.y, d.w, d.h],
          classId: d.classId,
          label: d.label,
          score: d.score,
          hits: 1,
          age: 0,
        };
        this.tracks.push(newTrack);
        out.push({ ...d, trackId: newTrack.id });
      }
    }

    // Retire stale tracks.
    this.tracks = this.tracks.filter((t) => t.age <= this.maxAge);
    return out;
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
  }

  get activeCount(): number {
    return this.tracks.filter((t) => t.age === 0).length;
  }
}
