import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  preview: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: {
    outDir: isSsrBuild ? "dist/server" : "dist/client",
    copyPublicDir: !isSsrBuild,
    ...(isSsrBuild
      ? { rollupOptions: { output: { entryFileNames: "index.js" } } }
      : {}),
  },
}));
