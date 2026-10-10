import assert from "node:assert/strict";
import { test } from "node:test";
import { sendChat } from "../src/services/chatClient";
import { allergyAction } from "../shared/demoResponses";
import type { ChatRequest } from "../shared/chat";

const request: ChatRequest = {
  message: "Peanut allergy",
  employee_role: "waiter",
  provider: "openai",
  model: "demo-gpt",
};

test("client uses one same-origin endpoint and preserves the request contract", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/chat");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body as string), request);
    return Response.json(allergyAction);
  });
  assert.deepEqual(await sendChat(request), allergyAction);
});

test("network errors do not silently produce local mock answers", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network failure");
  });
  await assert.rejects(sendChat(request), /Cannot reach the backend/);
});

test("client shows API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Choose a supported model." }, { status: 400 }),
  );
  await assert.rejects(sendChat(request), /Choose a supported model/);
});

test("non-JSON errors and malformed success payloads cannot become action cards", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Error</html>", { status: 502 }),
  );
  await assert.rejects(sendChat(request), /did not return JSON/);
  for (const invalid of [
    { type: "action" },
    { ...allergyAction, risk: "critical" },
    { ...allergyAction, escalate: "yes" },
    { ...allergyAction, actions: [] },
    { ...allergyAction, sources: [{ id: "fake" }] },
    { type: "message", content: "", sources: [] },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json(invalid));
    await assert.rejects(sendChat(request), /invalid chat response/);
  }
});

test("slow requests are aborted after the bounded timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(
    globalThis,
    "fetch",
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  );
  const reply = sendChat(request);
  t.mock.timers.tick(20_000);
  await assert.rejects(reply, /request timed out/);
});
