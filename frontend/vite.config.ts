import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre loads its map worker as a module URL. Keeping it out of Vite's
  // dependency pre-bundle prevents the dev server from rewriting that worker
  // to a missing optimized asset.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    proxy: {
      "/v1": "http://127.0.0.1:8000",
    },
  },
});
