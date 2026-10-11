import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // Keep the browser-facing Host so backend write-origin checks remain valid.
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
  preview: {
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
  build: {
    outDir: isSsrBuild ? "dist/server" : "dist/client",
    copyPublicDir: !isSsrBuild,
    ...(isSsrBuild
      ? { rollupOptions: { output: { entryFileNames: "index.js" } } }
      : {}),
  },
}));
