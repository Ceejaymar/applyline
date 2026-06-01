import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function copyManifestPlugin() {
  return {
    name: "copy-manifest",
    closeBundle: async () => {
      await mkdir(resolve(__dirname, "dist"), { recursive: true });
      await copyFile(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json"));
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/content/overlay.tsx"),
      output: {
        assetFileNames: "assets/[name][extname]",
        entryFileNames: "content/overlay.js",
        format: "iife",
        name: "ApplylineOverlay",
      },
    },
  },
});
