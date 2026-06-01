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
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        "content/overlay": resolve(__dirname, "src/content/overlay.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
