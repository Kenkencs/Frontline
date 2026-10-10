import { spawn } from "node:child_process";

// One command starts both processes. No application logic lives in this script.
const preview = process.argv.includes("--preview");
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      ...(preview ? [] : ["watch"]),
      "server/dev.ts",
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...(preview ? ["preview"] : []),
      "--host",
      "127.0.0.1",
    ],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
