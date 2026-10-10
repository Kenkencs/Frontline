import assert from "node:assert/strict";
import { test } from "node:test";
import { generateChat } from "../server/chat";
import {
  ProviderError,
  type AIProvider,
  type OutputSchema,
  type ProviderInput,
} from "../server/providers/AIProvider";
import { OpenAIProvider } from "../server/providers/OpenAIProvider";
import { createProvider } from "../server/providers/registry";
import type {
  ActionResponse,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from "../shared/chat";
import { isRecord } from "../shared/validation";

// All upstream responses and credentials in this file are deliberately fake.
const TEST_KEY = "fake-key-for-tests-only";
const PRIVATE_DETAIL = "provider-diagnostic-that-must-stay-private";
const providerInput: ProviderInput = {
  model: "fake-model",
  systemPrompt: "Give practical guidance.",
  prompt: "Where is the checklist?",
};
const chatInput: ChatRequest = {
  model: providerInput.model,
  message: "A customer reports a severe allergy.",
  employee_role: "waiter",
  provider: "anthropic",
};
const action: ActionResponse = {
  type: "action",
  risk: "high",
  summary: "Check the allergy information with the manager.",
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

function completedText(text: string): Response {
  return Response.json({
    status: "completed",
    output: [
      { type: "message", content: [{ type: "output_text", text }] },
    ],
  });
}

function controlledError(status: number) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.status, status);
    assert.ok(!error.message.includes(PRIVATE_DETAIL));
    assert.ok(!error.message.includes(TEST_KEY));
    return true;
  };
}

test("generateChat accepts a common provider for action and message responses without OpenAI", async (t) => {
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    networkCalls += 1;
    throw new Error("The application must use the injected provider");
  });
  const received: ProviderInput[] = [];
  let nextReply: ChatResponse = action;
  const fakeProvider: AIProvider = {
    async generate() {
      throw new Error("Chat must use structuredGenerate");
    },
    async structuredGenerate<T>(input: ProviderInput, schema: OutputSchema<T>) {
      received.push(input);
      assert.equal(schema.name, "frontline_chat");
      assert.equal(schema.jsonSchema.type, "object");
      return schema.parse({ response: nextReply });
    },
    async *stream() {
      throw new Error("Chat must return a complete response");
    },
  };

  assert.deepEqual(await generateChat(chatInput, fakeProvider), action);
  nextReply = message;
  assert.deepEqual(await generateChat(chatInput, fakeProvider), message);
  assert.equal(received.length, 2);
  for (const input of received) {
    assert.equal(input.model, chatInput.model);
    assert.equal(input.maxOutputTokens, 1200);
    assert.equal(typeof input.systemPrompt, "string");
    assert.ok(input.systemPrompt.length > 0);
    assert.deepEqual(JSON.parse(input.prompt), {
      employee_role: chatInput.employee_role,
      message: chatInput.message,
    });
  }
  assert.equal(networkCalls, 0);
});

test("application guards reject unsafe responses even if an adapter bypasses its schema parser", async () => {
  const inventedSource = {
    id: "invented",
    title: "Unverified company policy",
    version: "v99",
    section: "9",
    excerpt: PRIVATE_DETAIL,
  };
  const unsafeReplies: unknown[] = [
    { type: "action" },
    { ...action, actions: [] },
    { ...action, sources: [inventedSource] },
    { ...message, sources: [inventedSource] },
    { ...action, confidence: "medium" },
    { ...action, confidence: "high" },
    { ...action, escalate: false },
  ];
  for (const reply of unsafeReplies) {
    const unsafeProvider: AIProvider = {
      async generate() {
        throw new Error("Unexpected plain generation");
      },
      async structuredGenerate<T>() {
        // A deliberately faulty adapter: the application must validate again.
        return reply as T;
      },
      async *stream() {
        throw new Error("Unexpected streaming");
      },
    };
    await assert.rejects(
      () => generateChat(chatInput, unsafeProvider),
      controlledError(502),
    );
  }
});

test("OpenAIProvider.generate returns plain text without requesting JSON output", async () => {
  let calls = 0;
  let receivedUrl: RequestInfo | URL | undefined;
  let receivedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (url, init) => {
    calls += 1;
    receivedUrl = url;
    receivedInit = init;
    return completedText("Ask the manager for the current checklist.");
  };
  const provider = new OpenAIProvider(` ${TEST_KEY} `, fakeFetch);
  const response = await provider.generate({
    ...providerInput,
    maxOutputTokens: 64,
  });
  assert.equal(response, "Ask the manager for the current checklist.");
  assert.equal(calls, 1);
  assert.equal(receivedUrl, "https://api.openai.com/v1/responses");
  assert.equal(receivedInit?.method, "POST");
  assert.equal(
    new Headers(receivedInit?.headers).get("authorization"),
    `Bearer ${TEST_KEY}`,
  );
  assert.deepEqual(JSON.parse(receivedInit?.body as string), {
    model: providerInput.model,
    instructions: providerInput.systemPrompt,
    input: providerInput.prompt,
    store: false,
    max_output_tokens: 64,
  });
});

test("structuredGenerate uses the supplied schema and returns its parsed domain value", async () => {
  let parseCalls = 0;
  let parsedValue: unknown;
  let receivedInit: RequestInit | undefined;
  const schema: OutputSchema<{ upperCaseAnswer: string }> = {
    name: "checklist_answer",
    jsonSchema: {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
      additionalProperties: false,
    },
    parse(value) {
      parseCalls += 1;
      parsedValue = value;
      assert.ok(isRecord(value));
      assert.equal(typeof value.answer, "string");
      return { upperCaseAnswer: (value.answer as string).toUpperCase() };
    },
  };
  const provider = new OpenAIProvider(TEST_KEY, async (_url, init) => {
    receivedInit = init;
    return completedText(JSON.stringify({ answer: "ask the manager" }));
  });
  assert.deepEqual(await provider.structuredGenerate(providerInput, schema), {
    upperCaseAnswer: "ASK THE MANAGER",
  });
  assert.equal(parseCalls, 1);
  assert.deepEqual(parsedValue, { answer: "ask the manager" });
  const body = JSON.parse(receivedInit?.body as string);
  assert.equal(body.max_output_tokens, 1200);
  assert.deepEqual(body.text.format, {
    type: "json_schema",
    name: schema.name,
    strict: true,
    schema: schema.jsonSchema,
  });
});

test("structuredGenerate sanitizes schema parser failures", async () => {
  let parseCalls = 0;
  const schema: OutputSchema<never> = {
    name: "failing_parser",
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    parse() {
      parseCalls += 1;
      throw new Error(`${PRIVATE_DETAIL}: ${TEST_KEY}`);
    },
  };
  const provider = new OpenAIProvider(TEST_KEY, async () => completedText("{}"));
  await assert.rejects(
    () => provider.structuredGenerate(providerInput, schema),
    controlledError(502),
  );
  assert.equal(parseCalls, 1);
});

test("structuredGenerate rejects malformed JSON before calling the schema parser", async () => {
  let parseCalls = 0;
  const schema: OutputSchema<string> = {
    name: "unused_parser",
    jsonSchema: { type: "object" },
    parse() {
      parseCalls += 1;
      return "This must never be returned";
    },
  };
  const provider = new OpenAIProvider(TEST_KEY, async () => completedText("{"));
  await assert.rejects(
    () => provider.structuredGenerate(providerInput, schema),
    controlledError(502),
  );
  assert.equal(parseCalls, 0);
});

test("registry maps only implemented live providers and never falls back to OpenAI", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    return completedText("Registry-selected provider");
  };
  const config = {
    apiKeys: {
      openai: TEST_KEY,
      anthropic: "fake-anthropic-key",
      deepseek: "fake-deepseek-key",
      kimi: "fake-kimi-key",
    },
    fetchImpl: fakeFetch,
  };
  const provider = createProvider("openai", config);
  assert.ok(provider instanceof OpenAIProvider);
  assert.equal(await provider.generate(providerInput), "Registry-selected provider");
  assert.equal(calls, 1);
  const unsupported: ProviderId[] = ["anthropic", "deepseek", "kimi"];
  for (const id of unsupported) {
    assert.throws(() => createProvider(id, config), controlledError(501));
  }
  assert.equal(calls, 1);
});

test("stream explicitly reports deferred support without calling upstream", async () => {
  let calls = 0;
  const provider = new OpenAIProvider(TEST_KEY, async () => {
    calls += 1;
    return completedText("No unfinished response should be sent");
  });
  const chunks: string[] = [];
  await assert.rejects(async () => {
    for await (const chunk of provider.stream(providerInput)) chunks.push(chunk);
  }, controlledError(501));
  assert.deepEqual(chunks, []);
  assert.equal(calls, 0);
});
