import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../server/worker";

test("Worker routes API requests separately from frontend assets", async () => {
  const env = {
    ASSETS: {
      fetch: async () =>
        new Response("frontend", { headers: { "Content-Type": "text/html" } }),
    },
  };
  const page = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(await page.text(), "frontend");
  const reply = await worker.fetch(
    new Request("https://example.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Opening shift",
        employee_role: "cashier",
        provider: "kimi",
        model: "demo-kimi",
      }),
    }),
    env,
  );
  assert.equal(reply.status, 200);
  assert.equal((await reply.json()).type, "message");
  const unknown = await worker.fetch(
    new Request("https://example.test/api/missing"),
    env,
  );
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, "API route not found.");
});
