// Shared, isomorphic types for the WASM YOLO client.
// Kept in a plain (non-.client) module so route files can import them
// without triggering client-only import protection.
export type Detection = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  classId: number;
  label: string;
};

// Track ID assigned by the lightweight IoU tracker.
export type TrackedDetection = Detection & { trackId: number };
