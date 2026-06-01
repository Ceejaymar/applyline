import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/background.ts"),
      output: {
        entryFileNames: "background.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        format: "es",
      },
    },
  },
});
