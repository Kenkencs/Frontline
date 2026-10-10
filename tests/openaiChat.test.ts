import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApiRequest, type ApiOptions } from "../server/api";
import worker from "../server/worker";
import type { chatOutputSchema } from "../server/responseSchema";
import { models } from "../shared/catalog";
import type { ActionResponse, ChatRequest, ChatResponse } from "../shared/chat";
import { isRecord, parseChatResponse } from "../shared/validation";

// Deliberately fake: these tests never read environment variables or call OpenAI.
const TEST_KEY = "fake-key-for-tests-only";
const UPSTREAM_DETAIL = "upstream-diagnostic-must-not-reach-the-browser";
const liveModel = models.find(
  (model) => model.provider === "openai" && model.mode === "live",
);
assert.ok(liveModel, "The catalog must contain the increment-3 live model");

const input: ChatRequest = {
  message: "A customer reports a severe peanut allergy",
  employee_role: "waiter",
  provider: "openai",
  model: liveModel.model,
};
const action: ActionResponse = {
  type: "action",
  risk: "high",
  summary: "The customer's allergy needs manager verification.",
  actions: ["Check the current allergen records.", "Ask the manager for help."],
  sources: [],
  confidence: "low",
  escalate: true,
};
const message: Extract<ChatResponse, { type: "message" }> = {
  type: "message",
  content: "Ask your manager where the current shift checklist is kept.",
  sources: [],
};

function request(value: unknown = input): Request {
  return new Request("https://frontline.example.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function outputText(text: string) {
  return {
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
  };
}

function completion(reply: unknown): Response {
  return Response.json(outputText(JSON.stringify({ response: reply })));
}

function options(fetchImpl: typeof fetch): ApiOptions {
  return { apiKeys: { openai: TEST_KEY }, fetchImpl, documents: [] };
}

function assertGuardedAction(reply: ChatResponse): void {
  assert.ok(reply.type === "action");
  assert.equal(reply.risk, "high");
  assert.equal(reply.confidence, "low");
  assert.equal(reply.escalate, true);
  assert.deepEqual(reply.sources, []);
  assert.match(reply.summary, /Possible allergy case/);
  assert.ok(reply.actions.includes("Do not confirm that the food is safe."));
  assert.ok(reply.actions.includes("Check the latest allergen information."));
  assert.ok(reply.actions.includes("Check cross-contamination information."));
  assert.ok(
    reply.actions.some((step) =>
      /manager.*safety cannot be verified/.test(step),
    ),
  );
}

function assertOrdinaryReply(
  reply: ChatResponse,
  evidence: "missing" | "sample" = "missing",
): void {
  assert.ok(reply.type === "message");
  if (evidence === "sample") {
    assert.ok(reply.content.startsWith("Relevant procedure:"));
    assert.match(reply.content, /Read the handover/);
    assert.match(reply.content, /fictional samples/);
    assert.equal(reply.sources.length, 1);
    const source = reply.sources[0];
    assert.equal(source.id, "opening-checklist:1:opening");
    assert.equal(source.version, "v1");
    assert.equal(source.sample, true);
    assert.ok(reply.content.includes(source.excerpt));
  } else {
    assert.ok(
      reply.content.startsWith(
        "I could not find a current policy for this question.",
      ),
    );
    assert.deepEqual(reply.sources, []);
  }
  assert.match(reply.content, /manager.*company policy/);
}

async function assertError(
  response: Response,
  status: number,
): Promise<string> {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const value: unknown = await response.json();
  assert.ok(isRecord(value));
  assert.deepEqual(Object.keys(value), ["error"]);
  assert.equal(typeof value.error, "string");
  const error = value.error as string;
  assert.ok(
    !error.includes(TEST_KEY),
    "Errors must not return even the fake key",
  );
  assert.ok(
    !error.includes(UPSTREAM_DETAIL),
    "Upstream diagnostics stay private",
  );
  return error;
}

function assertStrictObjects(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertStrictObjects);
    return;
  }
  if (!isRecord(value)) return;
  if (value.type === "object") {
    assert.equal(value.additionalProperties, false);
    assert.ok(isRecord(value.properties));
    assert.ok(Array.isArray(value.required));
    assert.deepEqual(
      [...value.required].sort(),
      Object.keys(value.properties).sort(),
      "Every schema object property must be required",
    );
  }
  Object.values(value).forEach(assertStrictObjects);
}

test("live /api/chat sends a strict Responses request and returns the action contract", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("authorization"), `Bearer ${TEST_KEY}`);
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(init?.body as string);
    assert.equal(body.model, input.model);
    assert.equal(body.store, false);
    assert.ok(body.max_output_tokens > 0 && body.max_output_tokens <= 1200);
    assert.equal(typeof body.instructions, "string");
    const prompt = JSON.parse(body.input);
    assert.deepEqual(Object.keys(prompt).sort(), [
      "employee_role",
      "knowledge",
      "message",
      "risk_assessment",
    ]);
    assert.equal(prompt.employee_role, input.employee_role);
    assert.equal(prompt.message, input.message);
    assert.deepEqual(prompt.knowledge, {
      mode: "none",
      missing: true,
      sources: [],
    });
    assert.equal(prompt.risk_assessment.risk, "high");
    assert.equal(prompt.risk_assessment.escalate, true);
    assert.equal(prompt.risk_assessment.requiresAction, true);
    assert.ok(!(init?.body as string).includes(TEST_KEY));
    assert.ok(!body.input.includes("client-injected"));
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(typeof body.text.format.name, "string");
    const schema = body.text.format.schema as typeof chatOutputSchema;
    assert.equal(schema.type, "object");
    assert.ok(!("anyOf" in schema), "The union must not be the schema root");
    assert.equal(schema.properties.response.anyOf.length, 2);
    assertStrictObjects(schema);
    for (const branch of schema.properties.response.anyOf) {
      assert.equal(branch.properties.sources.maxItems, 4);
      if (branch.properties.confidence)
        assert.deepEqual(branch.properties.confidence.enum, ["low", "medium"]);
    }
    return completion(action);
  };
  const response = await handleApiRequest(
    request({
      ...input,
      message: `  ${input.message}  `,
      api_key: "client-injected",
    }),
    {
      apiKeys: { openai: ` ${TEST_KEY} ` },
      fetchImpl: fakeFetch,
      documents: [],
    },
  );
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assertGuardedAction(parseChatResponse(await response.json()));
});

test("live ordinary replies use the existing message contract", async () => {
  const response = await handleApiRequest(
    request({
      ...input,
      employee_role: "cashier",
      message: "Where is the checklist?",
    }),
    options(async () => completion(message)),
  );
  assert.equal(response.status, 200);
  assertOrdinaryReply(parseChatResponse(await response.json()));
});

test("every demo bypasses upstream with or without a configured key", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error("A demo must never call a paid provider");
  };
  for (const model of models.filter((item) => item.mode === "demo")) {
    for (const key of [undefined, TEST_KEY]) {
      const response = await handleApiRequest(
        request({ ...input, provider: model.provider, model: model.model }),
        { apiKeys: { openai: key }, fetchImpl: fakeFetch },
      );
      assert.equal(response.status, 200);
      assert.equal(parseChatResponse(await response.json()).type, "action");
    }
  }
  assert.equal(calls, 0);
});

test("missing and blank backend keys return 503 without calling upstream", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    return completion(action);
  };
  for (const key of [undefined, "", "   "]) {
    const response = await handleApiRequest(request(), {
      apiKeys: { openai: key },
      fetchImpl: fakeFetch,
    });
    assert.match(await assertError(response, 503), /not configured/);
  }
  assert.equal(calls, 0);
});

test("unknown or mismatched live selections fail validation before upstream", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    return completion(action);
  };
  for (const invalid of [
    { ...input, provider: "anthropic" },
    { ...input, provider: "deepseek" },
    { ...input, provider: "unknown" },
    { ...input, model: "unapproved-live-model" },
    { ...input, provider: "openai", model: "demo-claude" },
  ]) {
    const response = await handleApiRequest(
      request(invalid),
      options(fakeFetch),
    );
    await assertError(response, 400);
  }
  assert.equal(calls, 0);
});

test("model refusals are controlled even when accompanied by valid output text", async () => {
  const value = outputText(JSON.stringify({ response: action }));
  value.output.push({
    type: "message",
    role: "assistant",
    content: [{ type: "refusal", refusal: UPSTREAM_DETAIL }],
  } as unknown as (typeof value.output)[number]);
  const response = await handleApiRequest(
    request(),
    options(async () => Response.json(value)),
  );
  assert.match(await assertError(response, 422), /could not help/);
});

test("incomplete or failed model output is never treated as a completed card", async () => {
  for (const status of ["incomplete", "failed", "in_progress"]) {
    const response = await handleApiRequest(
      request(),
      options(async () =>
        Response.json({
          ...outputText(JSON.stringify({ response: action })),
          status,
          incomplete_details: { reason: "max_output_tokens" },
        }),
      ),
    );
    assert.match(await assertError(response, 502), /incomplete response/);
  }
});

test("malformed envelopes, output text, and non-JSON upstream replies return sanitized 502", async () => {
  const responses = [
    () => new Response(UPSTREAM_DETAIL, { status: 200 }),
    () => Response.json(null),
    () => Response.json({ status: "completed" }),
    () => Response.json({ status: "completed", output: [] }),
    () => Response.json(outputText("{")),
    () => Response.json(outputText("null")),
    () => Response.json(outputText(JSON.stringify({ unexpected: action }))),
    () =>
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ response: action }),
              },
              {
                type: "output_text",
                text: JSON.stringify({ response: message }),
              },
            ],
          },
        ],
      }),
  ];
  for (const responseFactory of responses) {
    const response = await handleApiRequest(
      request(),
      options(async () => responseFactory()),
    );
    await assertError(response, 502);
  }
});

test("schema-invalid action and message fields cannot reach the frontend", async () => {
  for (const invalid of [
    { type: "action" },
    { ...action, risk: "critical" },
    { ...action, summary: "" },
    { ...action, actions: [] },
    { ...action, actions: [12] },
    { ...action, escalate: "yes" },
    { ...action, sources: "none" },
    { ...message, content: "" },
    { ...message, content: 12 },
    { ...message, sources: [{ id: "incomplete-source" }] },
  ]) {
    const response = await handleApiRequest(
      request(),
      options(async () => completion(invalid)),
    );
    await assertError(response, 502);
  }
});

test("invented citations are rejected for both action and message replies", async () => {
  const invented = {
    id: "invented-sop",
    title: "Invented company policy",
    version: "v99",
    section: "§9",
    excerpt: "An unverified policy that the application did not retrieve.",
  };
  for (const reply of [action, message]) {
    const response = await handleApiRequest(
      request(
        reply.type === "message"
          ? { ...input, message: "Where is the opening checklist?" }
          : input,
      ),
      options(async () => completion({ ...reply, sources: [invented] })),
    );
    await assertError(response, 502);
  }
});

test("live action confidence must stay low without company evidence", async () => {
  for (const confidence of ["medium", "high"]) {
    const response = await handleApiRequest(
      request(),
      options(async () => completion({ ...action, confidence })),
    );
    await assertError(response, 502);
  }
});

test("high-risk live actions must request escalation", async () => {
  const response = await handleApiRequest(
    request(),
    options(async () => completion({ ...action, escalate: false })),
  );
  await assertError(response, 502);
});

test("upstream authentication, usage-limit, and server errors are sanitized", async () => {
  for (const [upstreamStatus, expectedStatus] of [
    [401, 503],
    [403, 503],
    [429, 429],
    [500, 502],
  ]) {
    const response = await handleApiRequest(
      request(),
      options(async () =>
        Response.json(
          { error: { message: `${UPSTREAM_DETAIL}: ${TEST_KEY}` } },
          { status: upstreamStatus },
        ),
      ),
    );
    await assertError(response, expectedStatus);
  }
});

test("upstream network failures do not leak exception details", async () => {
  const response = await handleApiRequest(
    request(),
    options(async () => {
      throw new TypeError(`${UPSTREAM_DETAIL}: ${TEST_KEY}`);
    }),
  );
  await assertError(response, 502);
});

test("the upstream timeout aborts the request and returns a controlled 504", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | null | undefined;
  const fakeFetch: typeof fetch = (_url, init) => {
    signal = init?.signal;
    started();
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener(
        "abort",
        () => reject(new Error(UPSTREAM_DETAIL)),
        { once: true },
      );
    });
  };
  const pending = handleApiRequest(request(), options(fakeFetch));
  // Reading the request body is asynchronous; tick after upstream actually starts.
  await fetching;
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(15_000);
  const response = await pending;
  assert.equal(signal?.aborted, true);
  assert.match(await assertError(response, 504), /timed out/);
});

test("the Worker passes its backend key binding to live OpenAI without serving assets", async (t) => {
  let upstreamCalls = 0;
  let assetCalls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      upstreamCalls += 1;
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${TEST_KEY}`,
      );
      return completion(message);
    },
  );
  const response = await worker.fetch(
    request({ ...input, message: "Where is the opening checklist?" }),
    {
      OPENAI_API_KEY: TEST_KEY,
      ASSETS: {
        fetch: async () => {
          assetCalls += 1;
          return new Response("assets");
        },
      },
    },
  );
  assert.equal(response.status, 200);
  assertOrdinaryReply(parseChatResponse(await response.json()), "sample");
  assert.equal(upstreamCalls, 1);
  assert.equal(assetCalls, 0);
});
