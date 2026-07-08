// Vite TanStack configuration file.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // onnxruntime-web is a large WASM-backed module that Vite's dep optimizer
    // sometimes aborts mid-transform. Exclude it so the browser fetches the
    // package's own ESM entry directly.
    optimizeDeps: { exclude: ["onnxruntime-web"] },
  },
});
