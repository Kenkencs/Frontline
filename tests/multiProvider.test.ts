import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApiRequest } from "../server/api";
import { AnthropicProvider } from "../server/providers/AnthropicProvider";
import { DeepSeekProvider } from "../server/providers/DeepSeekProvider";
import { KimiProvider } from "../server/providers/KimiProvider";
import {
  type OutputSchema,
  type ProviderInput,
} from "../server/providers/AIProvider";
import { createProvider } from "../server/providers/registry";
import worker from "../server/worker";
import { models } from "../shared/catalog";
import type {
  ActionResponse,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from "../shared/chat";
import { isRecord, parseChatResponse } from "../shared/validation";

// All keys and upstream replies are fake. These tests never read .env or use a paid API.
const KEYS: Record<ProviderId, string> = {
  openai: "fake-openai-key-for-tests",
  anthropic: "fake-anthropic-key-for-tests",
  deepseek: "fake-deepseek-key-for-tests",
  kimi: "fake-kimi-key-for-tests",
};
const PRIVATE_DETAIL = "upstream-private-diagnostic-for-tests";
const adapters = [
  {
    id: "anthropic",
    Provider: AnthropicProvider,
    url: "https://api.anthropic.com/v1/messages",
  },
  {
    id: "deepseek",
    Provider: DeepSeekProvider,
    url: "https://api.deepseek.com/chat/completions",
  },
  {
    id: "kimi",
    Provider: KimiProvider,
    url: "https://api.moonshot.ai/v1/chat/completions",
  },
] as const;
const action: ActionResponse = {
  type: "action",
  risk: "high",
  summary: "A reported allergy needs verification.",
  actions: ["Check current allergen records.", "Ask the manager for help."],
  sources: [],
  confidence: "low",
  escalate: true,
};
const message: ChatResponse = {
  type: "message",
  content: "Ask the manager where the current checklist is kept.",
  sources: [],
};
const providerInput: ProviderInput = {
  model: "fake-model",
  systemPrompt: "Give practical guidance.",
  prompt: "Where is the checklist?",
};

function inputFor(provider: ProviderId): ChatRequest {
  const model = models.find(
    (item) => item.provider === provider && item.mode === "live",
  );
  assert.ok(model, `The catalog must contain a live ${provider} model`);
  return {
    message: "A customer reports a severe allergy.",
    employee_role: "waiter",
    provider,
    model: model.model,
  };
}

function request(value: unknown): Request {
  return new Request("https://frontline.example.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function textEnvelope(
  provider: ProviderId,
  text: string,
): Record<string, unknown> {
  if (provider === "anthropic")
    return {
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: PRIVATE_DETAIL },
        { type: "redacted_thinking", data: PRIVATE_DETAIL },
        { type: "text", text },
      ],
    };
  return {
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: text,
          reasoning_content: PRIVATE_DETAIL,
        },
      },
    ],
  };
}

function completion(provider: ProviderId, reply: unknown): Response {
  return Response.json(
    textEnvelope(provider, JSON.stringify({ response: reply })),
  );
}

function assertSanitized(text: string): void {
  assert.ok(
    !text.includes(PRIVATE_DETAIL),
    "Upstream diagnostics stay private",
  );
  for (const key of Object.values(KEYS))
    assert.ok(!text.includes(key), "Keys stay private");
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
  assertSanitized(value.error as string);
  return value.error as string;
}

test("each new provider route uses its own key and transport with the same chat contract", async () => {
  for (const adapter of adapters) {
    const input = inputFor(adapter.id);
    let calls = 0;
    let nextReply: ChatResponse = action;
    let currentMessage = input.message;
    const fakeFetch: typeof fetch = async (url, init) => {
      calls += 1;
      assert.equal(url, adapter.url);
      assert.equal(init?.method, "POST");
      assert.ok(init?.signal instanceof AbortSignal);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("content-type"), "application/json");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, input.model);
      assert.equal(body.stream, false);
      assertSanitized(init?.body as string);
      if (adapter.id === "anthropic") {
        assert.equal(headers.get("x-api-key"), KEYS.anthropic);
        assert.equal(headers.get("authorization"), null);
        assert.equal(headers.get("anthropic-version"), "2023-06-01");
        assert.equal(body.max_tokens, 1200);
        assert.equal(body.output_config.format.type, "json_schema");
        assert.equal(body.output_config.format.schema.type, "object");
        const branches =
          body.output_config.format.schema.properties.response.anyOf;
        assert.equal(branches.length, 2);
        for (const branch of branches) {
          assert.ok(!("maxItems" in branch.properties.sources));
          if (branch.properties.actions)
            assert.ok(!("maxItems" in branch.properties.actions));
        }
        assert.equal(typeof body.system, "string");
        assert.deepEqual(
          body.messages.map((item: { role: string }) => item.role),
          ["user"],
        );
      } else {
        assert.equal(
          headers.get("authorization"),
          `Bearer ${KEYS[adapter.id]}`,
        );
        assert.equal(headers.get("x-api-key"), null);
        assert.deepEqual(body.response_format, { type: "json_object" });
        assert.deepEqual(body.thinking, { type: "disabled" });
        assert.deepEqual(
          body.messages.map((item: { role: string }) => item.role),
          ["system", "user"],
        );
        assert.match(body.messages[0].content, /JSON schema/);
        assert.match(body.messages[0].content, /"response"/);
        const tokenField =
          adapter.id === "kimi" ? "max_completion_tokens" : "max_tokens";
        assert.equal(body[tokenField], 1200);
        const unusedTokenField =
          adapter.id === "kimi" ? "max_tokens" : "max_completion_tokens";
        assert.ok(!(unusedTokenField in body));
      }
      const prompt = JSON.parse(body.messages.at(-1).content);
      assert.deepEqual(Object.keys(prompt).sort(), [
        "employee_role",
        "knowledge",
        "message",
        "risk_assessment",
      ]);
      assert.equal(prompt.employee_role, input.employee_role);
      assert.equal(prompt.message, currentMessage);
      assert.deepEqual(prompt.knowledge, {
        mode: "none",
        missing: true,
        sources: [],
      });
      assert.equal(
        prompt.risk_assessment.risk,
        nextReply.type === "action" ? "high" : "low",
      );
      assert.equal(
        prompt.risk_assessment.requiresAction,
        nextReply.type === "action",
      );
      return completion(adapter.id, nextReply);
    };
    const config = {
      apiKeys: { ...KEYS, [adapter.id]: ` ${KEYS[adapter.id]} ` },
      fetchImpl: fakeFetch,
      documents: [],
    };
    assert.ok(createProvider(adapter.id, config) instanceof adapter.Provider);
    for (const reply of [action, message]) {
      nextReply = reply;
      currentMessage =
        reply.type === "message"
          ? "Where is the opening checklist?"
          : input.message;
      const response = await handleApiRequest(
        request({ ...input, message: currentMessage }),
        config,
      );
      assert.equal(response.status, 200);
      const result = parseChatResponse(await response.json());
      assert.equal(result.type, reply.type);
      assert.deepEqual(result.sources, []);
      if (result.type === "action") {
        assert.equal(result.risk, "high");
        assert.equal(result.escalate, true);
        assert.equal(result.confidence, "low");
        assert.match(result.summary, /Possible allergy case/);
        assert.ok(
          result.actions.includes("Do not confirm that the food is safe."),
        );
        assert.ok(
          result.actions.includes("Check the latest allergen information."),
        );
        assert.ok(
          result.actions.includes("Check cross-contamination information."),
        );
      } else {
        assert.ok(
          result.content.startsWith(
            "I could not find a current policy for this question.",
          ),
        );
        assert.match(
          result.content,
          /manager.*current relevant company policy/,
        );
      }
    }
    assert.equal(calls, 2);
  }
});

test("missing provider keys never fall back to another configured provider and demos stay isolated", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error("No upstream call is permitted in this test");
  };
  for (const provider of Object.keys(KEYS) as ProviderId[]) {
    for (const missing of [undefined, "", "   "]) {
      const response = await handleApiRequest(request(inputFor(provider)), {
        apiKeys: { ...KEYS, [provider]: missing },
        documents: [],
        fetchImpl: fakeFetch,
      });
      assert.match(await assertError(response, 503), /not configured/);
    }
  }
  for (const model of models.filter((item) => item.mode === "demo")) {
    for (const apiKeys of [undefined, KEYS]) {
      const response = await handleApiRequest(
        request({ ...inputFor(model.provider), model: model.model }),
        {
          apiKeys,
          documents: [],
          fetchImpl: fakeFetch,
        },
      );
      assert.equal(response.status, 200);
      assert.equal(parseChatResponse(await response.json()).type, "action");
    }
  }
  assert.equal(calls, 0);
});

test("new providers reject incomplete, refused, malformed and ambiguous upstream answers", async () => {
  const text = JSON.stringify({ response: action });
  for (const adapter of adapters) {
    const cases: { value: unknown; status: number }[] = [
      { value: null, status: 502 },
      { value: {}, status: 502 },
    ];
    if (adapter.id === "anthropic") {
      const base = {
        type: "message",
        role: "assistant",
        stop_reason: "end_turn",
        content: [{ type: "text", text }],
      };
      cases.push(
        { value: { ...base, stop_reason: "max_tokens" }, status: 502 },
        { value: { ...base, stop_reason: "tool_use" }, status: 502 },
        { value: { ...base, stop_reason: "refusal" }, status: 422 },
        { value: { ...base, role: "user" }, status: 502 },
        {
          value: {
            ...base,
            content: [
              ...base.content,
              { type: "tool_use", input: PRIVATE_DETAIL },
            ],
          },
          status: 502,
        },
        {
          value: { ...base, content: [...base.content, ...base.content] },
          status: 502,
        },
        {
          value: { ...base, content: [{ type: "text", text: "" }] },
          status: 502,
        },
      );
    } else {
      const choice = {
        finish_reason: "stop",
        message: { role: "assistant", content: text },
      };
      cases.push(
        { value: { choices: [] }, status: 502 },
        { value: { choices: [choice, choice] }, status: 502 },
        {
          value: { choices: [{ ...choice, finish_reason: "length" }] },
          status: 502,
        },
        {
          value: { choices: [{ ...choice, finish_reason: "tool_calls" }] },
          status: 502,
        },
        {
          value: { choices: [{ ...choice, finish_reason: "content_filter" }] },
          status: 422,
        },
        {
          value: {
            choices: [
              {
                ...choice,
                message: { ...choice.message, refusal: PRIVATE_DETAIL },
              },
            ],
          },
          status: 422,
        },
        {
          value: {
            choices: [
              {
                ...choice,
                message: {
                  ...choice.message,
                  tool_calls: [{ arguments: PRIVATE_DETAIL }],
                },
              },
            ],
          },
          status: 502,
        },
        {
          value: {
            choices: [
              { ...choice, message: { ...choice.message, role: "user" } },
            ],
          },
          status: 502,
        },
        {
          value: {
            choices: [
              { ...choice, message: { ...choice.message, content: "" } },
            ],
          },
          status: 502,
        },
      );
    }
    for (const item of cases) {
      const response = await handleApiRequest(request(inputFor(adapter.id)), {
        apiKeys: KEYS,
        documents: [],
        fetchImpl: async () => Response.json(item.value),
      });
      await assertError(response, item.status);
    }
  }
});

test("all new live routes enforce JSON, action bounds and company-evidence guards", async () => {
  const inventedSource = {
    id: "fake",
    title: "Unverified SOP",
    version: "v99",
    section: "1",
    excerpt: PRIVATE_DETAIL,
  };
  const unsafe = [
    { ...action, actions: [] },
    {
      ...action,
      actions: Array.from({ length: 9 }, () => "Check the record."),
    },
    { ...action, sources: [inventedSource] },
    { ...message, sources: [inventedSource] },
    { ...action, confidence: "medium" },
    { ...action, confidence: "high" },
    { ...action, escalate: false },
  ];
  for (const adapter of adapters) {
    for (const reply of unsafe) {
      await assertError(
        await handleApiRequest(request(inputFor(adapter.id)), {
          apiKeys: KEYS,
          documents: [],
          fetchImpl: async () => completion(adapter.id, reply),
        }),
        502,
      );
    }
    for (const text of ["{", "null", JSON.stringify({ wrong: action })]) {
      await assertError(
        await handleApiRequest(request(inputFor(adapter.id)), {
          apiKeys: KEYS,
          documents: [],
          fetchImpl: async () => Response.json(textEnvelope(adapter.id, text)),
        }),
        502,
      );
    }
  }
});

test("provider transport errors are sanitized with common statuses", async () => {
  for (const adapter of adapters) {
    for (const [upstreamStatus, expectedStatus] of [
      [401, 503],
      [403, 503],
      [429, 429],
      [500, 502],
    ]) {
      await assertError(
        await handleApiRequest(request(inputFor(adapter.id)), {
          apiKeys: KEYS,
          documents: [],
          fetchImpl: async () =>
            new Response(`${PRIVATE_DETAIL}: ${KEYS[adapter.id]}`, {
              status: upstreamStatus,
            }),
        }),
        expectedStatus,
      );
    }
    for (const fakeFetch of [
      async () => {
        throw new TypeError(`${PRIVATE_DETAIL}: ${KEYS[adapter.id]}`);
      },
      async () => new Response(PRIVATE_DETAIL, { status: 200 }),
    ]) {
      await assertError(
        await handleApiRequest(request(inputFor(adapter.id)), {
          apiKeys: KEYS,
          documents: [],
          fetchImpl: fakeFetch,
        }),
        502,
      );
    }
  }
  await assertError(
    await handleApiRequest(request(inputFor("kimi")), {
      apiKeys: KEYS,
      documents: [],
      fetchImpl: async () =>
        Response.json(
          { error: { type: "content_filter", message: PRIVATE_DETAIL } },
          { status: 400 },
        ),
    }),
    422,
  );
});

test("all new providers abort after the same 15-second timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const adapter of adapters) {
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
          () => reject(new Error(PRIVATE_DETAIL)),
          { once: true },
        );
      });
    };
    const pending = handleApiRequest(request(inputFor(adapter.id)), {
      apiKeys: KEYS,
      documents: [],
      fetchImpl: fakeFetch,
    });
    await fetching;
    t.mock.timers.tick(14_999);
    assert.equal(signal?.aborted, false);
    t.mock.timers.tick(1);
    assert.match(await assertError(await pending, 504), /timed out/);
    assert.equal(signal?.aborted, true);
  }
});

test("new adapters support plain generation and supplied structured parsers", async () => {
  const schema: OutputSchema<string> = {
    name: "answer",
    jsonSchema: {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
      additionalProperties: false,
    },
    parse(value) {
      assert.ok(isRecord(value));
      assert.equal(typeof value.answer, "string");
      return (value.answer as string).toUpperCase();
    },
  };
  for (const adapter of adapters) {
    let calls = 0;
    const provider = new adapter.Provider(
      KEYS[adapter.id],
      async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init?.body as string);
        assert.equal(
          body[adapter.id === "kimi" ? "max_completion_tokens" : "max_tokens"],
          64,
        );
        if (calls === 1) {
          assert.ok(!("output_config" in body));
          assert.ok(!("response_format" in body));
          if (adapter.id !== "anthropic")
            assert.equal(body.messages[0].content, providerInput.systemPrompt);
          return Response.json(textEnvelope(adapter.id, "Ask the manager."));
        }
        return Response.json(
          textEnvelope(
            adapter.id,
            JSON.stringify({ answer: "ask the manager" }),
          ),
        );
      },
    );
    const input = { ...providerInput, maxOutputTokens: 64 };
    assert.equal(await provider.generate(input), "Ask the manager.");
    assert.equal(
      await provider.structuredGenerate(input, schema),
      "ASK THE MANAGER",
    );
    assert.equal(calls, 2);
  }
});

test("Claude schema adaptation preserves keyword-like field names and never mutates the supplied schema", async () => {
  const jsonSchema = {
    type: "object",
    properties: {
      maxItems: {
        type: "array",
        items: { type: "string", maxLength: 10 },
        minItems: 1,
        maxItems: 8,
      },
      minimum: { type: "number", minimum: 0, maximum: 10 },
      nested: {
        anyOf: [
          {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3,
          },
        ],
      },
    },
    $defs: {
      maxItems: { type: "array", items: { type: "string" }, maxItems: 0 },
    },
    required: ["maxItems", "minimum", "nested"],
    additionalProperties: false,
  };
  const original = structuredClone(jsonSchema);
  const schema: OutputSchema<{
    maxItems: string[];
    minimum: number;
    nested: string[];
  }> = {
    name: "keyword_fields",
    jsonSchema,
    parse(value) {
      assert.deepEqual(jsonSchema, original);
      assert.deepEqual(value, {
        maxItems: ["one"],
        minimum: 1,
        nested: ["one", "two"],
      });
      return value as { maxItems: string[]; minimum: number; nested: string[] };
    },
  };
  const provider = new AnthropicProvider(KEYS.anthropic, async (_url, init) => {
    const sent = JSON.parse(init?.body as string).output_config.format.schema;
    assert.ok("maxItems" in sent.properties);
    assert.ok("minimum" in sent.properties);
    assert.ok("maxItems" in sent.$defs);
    assert.equal(sent.properties.maxItems.minItems, 1);
    assert.ok(!("maxItems" in sent.properties.maxItems));
    assert.ok(!("maxLength" in sent.properties.maxItems.items));
    assert.ok(!("minimum" in sent.properties.minimum));
    assert.ok(!("maximum" in sent.properties.minimum));
    assert.ok(!("minItems" in sent.properties.nested.anyOf[0]));
    assert.ok(!("maxItems" in sent.$defs.maxItems));
    return Response.json(
      textEnvelope(
        "anthropic",
        JSON.stringify({
          maxItems: ["one"],
          minimum: 1,
          nested: ["one", "two"],
        }),
      ),
    );
  });
  await provider.structuredGenerate(providerInput, schema);
  assert.deepEqual(jsonSchema, original);
});

test("Worker passes each new backend binding to its provider without serving assets", async (t) => {
  let current: (typeof adapters)[number] = adapters[0];
  let calls = 0;
  let assets = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      assert.equal(url, current.url);
      const headers = new Headers(init?.headers);
      assert.equal(
        headers.get(current.id === "anthropic" ? "x-api-key" : "authorization"),
        current.id === "anthropic"
          ? KEYS[current.id]
          : `Bearer ${KEYS[current.id]}`,
      );
      return completion(current.id, message);
    },
  );
  const env = {
    OPENAI_API_KEY: KEYS.openai,
    ANTHROPIC_API_KEY: KEYS.anthropic,
    DEEPSEEK_API_KEY: KEYS.deepseek,
    KIMI_API_KEY: KEYS.kimi,
    ASSETS: {
      fetch: async () => {
        assets += 1;
        return new Response("assets");
      },
    },
  };
  for (const adapter of adapters) {
    current = adapter;
    const response = await worker.fetch(
      request({
        ...inputFor(adapter.id),
        message: "Where is the opening checklist?",
      }),
      env,
    );
    assert.equal(response.status, 200);
    const reply = parseChatResponse(await response.json());
    assert.ok(reply.type === "message");
    assert.ok(reply.content.startsWith("Relevant procedure:"));
    assert.match(reply.content, /Read the handover/);
    assert.match(
      reply.content,
      /Sample guidance: check your current workplace procedure\./,
    );
    assert.equal(reply.sources.length, 1);
    const source = reply.sources[0];
    assert.equal(source.id, "opening-checklist:1:opening");
    assert.equal(source.version, "v1");
    assert.equal(source.sample, true);
    assert.ok(reply.content.includes(source.excerpt));
  }
  assert.equal(calls, adapters.length);
  assert.equal(assets, 0);
});
