import { describe, it, expect } from "vitest";
import { IoUTracker } from "./iou-tracker";
import type { Detection } from "./wasm-yolo-types";

function det(x: number, y: number, w = 20, h = 40, classId = 0, label = "person"): Detection {
  return { x, y, w, h, score: 0.9, classId, label };
}

describe("IoUTracker", () => {
  it("assigns stable IDs across consecutive frames with small motion", () => {
    const t = new IoUTracker();
    const a1 = t.update([det(100, 100), det(200, 100)]);
    const a2 = t.update([det(105, 102), det(203, 98)]);
    expect(a1[0].trackId).toBe(a2[0].trackId);
    expect(a1[1].trackId).toBe(a2[1].trackId);
  });

  it("creates new IDs when detections jump too far", () => {
    const t = new IoUTracker();
    const a1 = t.update([det(100, 100)]);
    const a2 = t.update([det(500, 500)]);
    expect(a1[0].trackId).not.toBe(a2[0].trackId);
  });

  it("retires tracks after maxAge frames without a match", () => {
    const t = new IoUTracker({ maxAge: 2 });
    t.update([det(100, 100)]);
    t.update([]);
    t.update([]);
    t.update([]);
    expect(t.activeCount).toBe(0);
  });

  it("does not merge detections of different classes", () => {
    const t = new IoUTracker();
    const a1 = t.update([det(100, 100, 20, 40, 0, "person")]);
    const a2 = t.update([det(100, 100, 20, 20, 32, "sports ball")]);
    expect(a1[0].trackId).not.toBe(a2[0].trackId);
  });
});
