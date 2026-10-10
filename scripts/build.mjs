import { rm } from "node:fs/promises";
import { build } from "vite";

// Clean the old output, then build React and the portable Worker separately.
await rm("dist", { recursive: true, force: true });
await build();
await build({ build: { ssr: "server/worker.ts" } });
await import("./prepare-hosting.mjs");
