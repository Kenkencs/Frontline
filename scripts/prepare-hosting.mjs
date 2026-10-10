import { mkdir, copyFile, writeFile } from "node:fs/promises";

// Sites deploys the Worker plus Vite's static assets. This file contains no secrets.
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile(
  "dist/server/wrangler.json",
  JSON.stringify(
    {
      name: "frontline",
      main: "index.js",
      compatibility_date: "2026-10-10",
      assets: {
        directory: "../client",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api", "/api/*"],
      },
    },
    null,
    2,
  ) + "\n",
);
