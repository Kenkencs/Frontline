import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../server/nodeServer";
import { handleApiRequest } from "../server/api";
import { models } from "../shared/catalog";
import { MAX_BODY_BYTES, parseChatResponse } from "../shared/validation";

const server = createApiServer();
let origin: string;
const input = {
  message: "Severe peanut allergy",
  employee_role: "waiter",
  provider: "openai",
  model: "demo-gpt",
};

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});
after(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections();
    }),
);

function post(value: unknown) {
  return fetch(origin + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

test("real HTTP produces a sourced high-risk card for every allowed demo pair", async () => {
  for (const model of models.filter((item) => item.mode === "demo")) {
    const response = await post({
      ...input,
      provider: model.provider,
      model: model.model,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const reply = parseChatResponse(await response.json());
    assert.equal(reply.type, "action");
    if (reply.type !== "action") assert.fail("Expected an action card");
    assert.equal(reply.risk, "high");
    assert.equal(reply.escalate, true);
    assert.equal(reply.actions.length, 4);
    assert.ok(
      reply.sources.every((source) => source.version && source.excerpt),
    );
  }
});

test("opening shift returns an ordinary message over HTTP", async () => {
  const response = await post({
    ...input,
    employee_role: "kitchen_staff",
    message: "Opening shift checklist",
  });
  assert.equal(response.status, 200);
  const reply = parseChatResponse(await response.json());
  assert.equal(reply.type, "message");
  assert.equal(reply.sources[0].id, "opening-1-1");
});

test("invalid fields and mismatched provider/model pairs are rejected", async () => {
  for (const invalid of [
    null,
    [],
    {},
    { ...input, message: "" },
    { ...input, message: "  " },
    { ...input, message: 23 },
    { ...input, message: "x".repeat(4001) },
    { ...input, employee_role: "manager" },
    { ...input, provider: "unknown" },
    { ...input, provider: "anthropic" },
    { ...input, model: "arbitrary-live-model" },
  ]) {
    const response = await post(invalid);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("malformed JSON and non-JSON content have controlled errors", async () => {
  const malformed = await fetch(origin + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  const plain = await fetch(origin + "/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
  assert.equal(plain.status, 415);
});

test("wrong method and unknown API routes do not return the SPA", async () => {
  const get = await fetch(origin + "/api/chat");
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
  const missing = await fetch(origin + "/api/missing");
  assert.equal(missing.status, 404);
  assert.equal(typeof (await missing.json()).error, "string");
});

test("oversized HTTP body is rejected", async () => {
  const response = await post({
    ...input,
    padding: "x".repeat(MAX_BODY_BYTES),
  });
  assert.equal(response.status, 413);
});

test("body limit also works without Content-Length", async () => {
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  assert.equal((await handleApiRequest(request)).status, 413);
});

test("chunked oversized HTTP requests still receive a JSON 413", async () => {
  const response = await fetch(origin + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /32 KiB/);
});
