import assert from "node:assert/strict";
import { test } from "node:test";
import { ProviderError, type AIProvider, type ProviderInput } from "../server/providers/AIProvider";
import { OpenAIProvider } from "../server/providers/OpenAIProvider";
import { AnthropicProvider } from "../server/providers/AnthropicProvider";
import { DeepSeekProvider } from "../server/providers/DeepSeekProvider";
import { KimiProvider } from "../server/providers/KimiProvider";
import { readServerEvents } from "../server/providers/sse";

// No environment reads or real network calls: every stream and key is fake.
const KEY = "fake-key-for-streaming-tests";
const PRIVATE = "private-upstream-diagnostic";
const input: ProviderInput = { model: "fake-model", systemPrompt: "Workplace guidance", prompt: "Where is the checklist?", maxOutputTokens: 80 };
const adapters = [
  { id: "openai", Provider: OpenAIProvider, url: "https://api.openai.com/v1/responses" },
  { id: "anthropic", Provider: AnthropicProvider, url: "https://api.anthropic.com/v1/messages" },
  { id: "deepseek", Provider: DeepSeekProvider, url: "https://api.deepseek.com/chat/completions" },
  { id: "kimi", Provider: KimiProvider, url: "https://api.moonshot.ai/v1/chat/completions" },
] as const;

function frame(value: unknown, name?: string): string {
  return `${name ? `event: ${name}\n` : ""}data: ${JSON.stringify(value)}\n\n`;
}
function openaiDelta(text: string) {
  return { type: "response.output_text.delta", item_id: "msg_fake", content_index: 0, delta: text };
}
function openaiComplete(text: string) {
  return { type: "response.completed", response: { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }] } };
}
function claudePrefix(text: string): string {
  return frame({ type: "message_start", message: { role: "assistant" } })
    + frame({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })
    + frame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
}
function claudeEnd(reason = "end_turn"): string {
  return frame({ type: "content_block_stop", index: 0 })
    + frame({ type: "message_delta", delta: { stop_reason: reason } })
    + frame({ type: "message_stop" });
}
function chatChunk(delta: unknown, finish_reason: string | null = null) {
  return { object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason }] };
}
function streamPrefix(id: string, text: string): string {
  if (id === "openai") return frame(openaiDelta(text));
  if (id === "anthropic") return claudePrefix(text);
  return frame(chatChunk({ role: "assistant", content: text }));
}
function completeStream(id: string, text: string): string {
  const prefix = streamPrefix(id, text);
  if (id === "openai") return prefix + frame(openaiComplete(text));
  if (id === "anthropic") return prefix + claudeEnd();
  return prefix + frame(chatChunk({}, "stop")) + "data: [DONE]\n\n";
}
function bytesStream(text: string, splitEvery = 0): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      if (splitEvery) {
        for (let offset = 0; offset < bytes.length; offset += splitEvery)
          controller.enqueue(bytes.slice(offset, offset + splitEvery));
      } else controller.enqueue(bytes);
      controller.close();
    },
  });
}
function streamResponse(text: string, splitEvery = 0): Response {
  return new Response(bytesStream(text, splitEvery), { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}
async function collect(provider: AIProvider): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of provider.stream(input)) chunks.push(chunk);
  return chunks;
}
function safeError(status: number) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.status, status);
    assert.ok(!error.message.includes(KEY));
    assert.ok(!error.message.includes(PRIVATE));
    return true;
  };
}

test("SSE handles split UTF-8, CRLF boundaries, comments and multiline data", async () => {
  const text = '\uFEFF: keepalive\r\nid: ignored\r\nevent: note\r\ndata: {\r\ndata: "text": "你好 🥜"\r\ndata: }\r\n\r\n: another ping\ndata: done\n\n';
  const events = [];
  for await (const event of readServerEvents(bytesStream(text, 1), new AbortController().signal)) events.push(event);
  assert.equal(events.length, 2);
  assert.equal(events[0].event, "note");
  assert.deepEqual(JSON.parse(events[0].data), { text: "你好 🥜" });
  assert.deepEqual(events[1], { event: "message", data: "done" });
});

test("all four adapters stream text through their own URL, auth and native payload", async () => {
  for (const adapter of adapters) {
    let captured: RequestInit | undefined;
    let capturedUrl: RequestInfo | URL | undefined;
    const provider = new adapter.Provider(` ${KEY} `, async (url, init) => {
      captured = init;
      capturedUrl = url;
      return streamResponse(completeStream(adapter.id, "你好 🥜"), 1);
    });
    assert.equal((await collect(provider)).join(""), "你好 🥜");
    assert.equal(capturedUrl, adapter.url);
    assert.equal(captured?.method, "POST");
    const headers = new Headers(captured?.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get(adapter.id === "anthropic" ? "x-api-key" : "authorization"), adapter.id === "anthropic" ? KEY : `Bearer ${KEY}`);
    assert.equal(headers.get(adapter.id === "anthropic" ? "authorization" : "x-api-key"), null);
    if (adapter.id === "anthropic") assert.equal(headers.get("anthropic-version"), "2023-06-01");
    const body = JSON.parse(captured?.body as string);
    assert.equal(body.model, input.model);
    assert.equal(body.stream, true);
    assert.ok(!(captured?.body as string).includes(KEY));
    assert.equal(body[adapter.id === "openai" ? "max_output_tokens" : adapter.id === "kimi" ? "max_completion_tokens" : "max_tokens"], 80);
    assert.ok(!("text" in body));
    assert.ok(!("output_config" in body));
    assert.ok(!("response_format" in body));
    if (adapter.id === "openai") {
      assert.equal(body.store, false);
      assert.equal(body.instructions, input.systemPrompt);
      assert.equal(body.input, input.prompt);
    } else {
      assert.equal(body.messages.at(-1).content, input.prompt);
      if (adapter.id === "anthropic") assert.equal(body.system, input.systemPrompt);
      else {
        assert.equal(body.messages[0].content, input.systemPrompt);
        assert.deepEqual(body.thinking, { type: "disabled" });
      }
    }
  }
});

test("OpenAI streams only output text and checks completed output against its deltas", async () => {
  const text = frame({ type: "response.reasoning_text.delta", delta: PRIVATE })
    + frame(openaiDelta("Ask ")) + frame(openaiDelta("the manager."))
    + frame(openaiComplete("Ask the manager."));
  const provider = new OpenAIProvider(KEY, async () => streamResponse(text));
  assert.deepEqual(await collect(provider), ["Ask ", "the manager."]);
  const inconsistent = new OpenAIProvider(KEY, async () => streamResponse(frame(openaiDelta("Ask ")) + frame(openaiComplete("Different output"))));
  await assert.rejects(() => collect(inconsistent), safeError(502));
});

test("named provider events agree with their JSON type and support multiline JSON", async () => {
  const delta = openaiDelta("text");
  const multiline = `event: response.output_text.delta\r\n${JSON.stringify(delta, null, 2).split("\n").map((line) => `data: ${line}\r\n`).join("")}\r\n`;
  const complete = frame(openaiComplete("text"), "response.completed");
  assert.deepEqual(await collect(new OpenAIProvider(KEY, async () => streamResponse(multiline + complete, 1))), ["text"]);
  await assert.rejects(() => collect(new OpenAIProvider(KEY, async () => streamResponse(frame(delta, "error") + complete))), safeError(502));
  await assert.rejects(() => collect(new AnthropicProvider(KEY, async () => streamResponse(frame({ type: "message_start", message: { role: "assistant" } }, "error")))), safeError(502));
  await assert.rejects(() => collect(new KimiProvider(KEY, async () => streamResponse(frame(chatChunk({ content: PRIVATE }), "error")))), safeError(502));
});

test("Claude ignores thinking/signatures and ping while preserving text order", async () => {
  const text = frame({ type: "message_start", message: { role: "assistant" } })
    + frame({ type: "content_block_start", index: 1, content_block: { type: "thinking" } })
    + frame({ type: "content_block_delta", index: 1, delta: { type: "thinking_delta", thinking: PRIVATE } })
    + frame({ type: "content_block_delta", index: 1, delta: { type: "signature_delta", signature: PRIVATE } })
    + frame({ type: "content_block_stop", index: 1 })
    + frame({ type: "ping" })
    + frame({ type: "content_block_start", index: 0, content_block: { type: "text", text: "Ask " } })
    + frame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "the manager." } })
    + claudeEnd();
  assert.deepEqual(await collect(new AnthropicProvider(KEY, async () => streamResponse(text))), ["Ask ", "the manager."]);
});

test("DeepSeek and Kimi ignore reasoning and usage-only chunks", async () => {
  const text = frame(chatChunk({ role: "assistant", reasoning_content: PRIVATE }))
    + frame(chatChunk({ content: "Ask " })) + frame(chatChunk({ content: "the manager." }))
    + frame(chatChunk({}, "stop"))
    + frame({ object: "chat.completion.chunk", choices: [], usage: { completion_tokens: 10 } })
    + "data: [DONE]\n\n";
  for (const Provider of [DeepSeekProvider, KimiProvider])
    assert.deepEqual(await collect(new Provider(KEY, async () => streamResponse(text))), ["Ask ", "the manager."]);
});

test("OpenAI refuses refusal events and rejects failed, incomplete, tool or ambiguous output", async () => {
  const cases: [unknown[], number][] = [
    [[{ type: "response.refusal.delta", delta: PRIVATE }], 422],
    [[{ type: "response.content_part.added", part: { type: "refusal", refusal: PRIVATE } }], 422],
    [[{ type: "response.incomplete", response: { status: "incomplete" } }], 502],
    [[{ type: "response.failed", response: { error: PRIVATE } }], 502],
    [[{ type: "error", message: `${PRIVATE}: ${KEY}` }], 502],
    [[{ type: "response.output_item.added", item: { type: "function_call", arguments: PRIVATE } }], 502],
    [[openaiDelta("one"), { ...openaiDelta("two"), content_index: 1 }], 502],
    [[openaiDelta(" "), openaiComplete(" ")], 502],
  ];
  for (const [events, status] of cases)
    await assert.rejects(() => collect(new OpenAIProvider(KEY, async () => streamResponse(events.map((event) => frame(event)).join("")))), safeError(status));
});

test("Claude rejects refusals, truncation, tools, error events and invalid block ordering", async () => {
  const cases: [string, number][] = [
    [claudePrefix("partial") + claudeEnd("refusal"), 422],
    [claudePrefix("partial") + claudeEnd("max_tokens"), 502],
    [claudePrefix("partial") + claudeEnd("tool_use"), 502],
    [frame({ type: "error", error: { message: `${PRIVATE}: ${KEY}` } }), 502],
    [frame({ type: "message_start", message: { role: "assistant" } }) + frame({ type: "content_block_start", index: 0, content_block: { type: "tool_use", input: PRIVATE } }), 502],
    [frame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: PRIVATE } }), 502],
    [claudePrefix("partial") + frame({ type: "message_stop" }), 502],
  ];
  for (const [text, status] of cases)
    await assert.rejects(() => collect(new AnthropicProvider(KEY, async () => streamResponse(text))), safeError(status));
});

test("chat-completion streams reject refusals, tools, bad candidates and truncation", async () => {
  const cases: [unknown, number][] = [
    [chatChunk({ refusal: PRIVATE }), 422],
    [chatChunk({}, "content_filter"), 422],
    [{ error: { type: "content_filter", message: PRIVATE } }, 422],
    [chatChunk({}, "length"), 502],
    [chatChunk({}, "tool_calls"), 502],
    [chatChunk({ content: "text", tool_calls: [{ arguments: PRIVATE }] }), 502],
    [chatChunk({ function_call: { arguments: PRIVATE } }), 502],
    [{ object: "chat.completion.chunk", choices: [chatChunk({}).choices[0], chatChunk({}).choices[0]] }, 502],
    [{ error: { message: `${PRIVATE}: ${KEY}` } }, 502],
    [chatChunk({ content: 12 }), 502],
  ];
  for (const Provider of [DeepSeekProvider, KimiProvider])
    for (const [value, status] of cases)
      await assert.rejects(() => collect(new Provider(KEY, async () => streamResponse(frame(value)))), safeError(status));
});

test("all adapters reject missing completion markers and unfinished SSE frames", async () => {
  for (const adapter of adapters) {
    await assert.rejects(() => collect(new adapter.Provider(KEY, async () => streamResponse(streamPrefix(adapter.id, "partial")))), safeError(502));
    const incompleteLastFrame = completeStream(adapter.id, "text").trimEnd();
    await assert.rejects(() => collect(new adapter.Provider(KEY, async () => streamResponse(incompleteLastFrame))), safeError(502));
  }
  for (const Provider of [DeepSeekProvider, KimiProvider]) {
    for (const text of ["data: [DONE]\n\n", frame(chatChunk({ content: "text" }, "stop"))])
      await assert.rejects(() => collect(new Provider(KEY, async () => streamResponse(text))), safeError(502));
  }
});

test("malformed JSON, invalid UTF-8, oversized SSE and wrong response types are sanitized", async () => {
  const invalidUtf8 = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([255])); controller.close(); } }), { headers: { "Content-Type": "text/event-stream" } });
  for (const adapter of adapters) {
    for (const response of [
      () => streamResponse(`data: ${PRIVATE}: ${KEY}\n\n`),
      () => streamResponse(`data: ${"x".repeat(65537)}\n\n`),
      () => Response.json({ message: PRIVATE }),
      invalidUtf8,
    ])
      await assert.rejects(() => collect(new adapter.Provider(KEY, async () => response())), safeError(502));
  }
});

test("streaming keeps common sanitized HTTP errors and rejects blank keys before fetch", async () => {
  for (const adapter of adapters) {
    for (const [httpStatus, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]])
      await assert.rejects(() => collect(new adapter.Provider(KEY, async () => new Response(`${PRIVATE}: ${KEY}`, { status: httpStatus }))), safeError(expected));
    await assert.rejects(() => collect(new adapter.Provider(KEY, async () => { throw new TypeError(`${PRIVATE}: ${KEY}`); })), safeError(502));
    let calls = 0;
    for (const key of [undefined, "", "   "])
      await assert.rejects(() => collect(new adapter.Provider(key, async () => { calls += 1; throw new Error(PRIVATE); })), safeError(503));
    assert.equal(calls, 0);
  }
});

test("a body read error is sanitized and cancels the remaining stream", async () => {
  for (const adapter of adapters) {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error(`${PRIVATE}: ${KEY}`)); } });
    const provider = new adapter.Provider(KEY, async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
    await assert.rejects(() => collect(provider), safeError(502));
    assert.equal(body.locked, false);
  }
});

test("the 15-second timeout aborts streams before response headers arrive", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const adapter of adapters) {
    let signal: AbortSignal | null | undefined;
    const fakeFetch: typeof fetch = (_url, init) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new Error(PRIVATE)), { once: true }));
    };
    const pending = collect(new adapter.Provider(KEY, fakeFetch));
    assert.equal(signal?.aborted, false);
    t.mock.timers.tick(15_000);
    await assert.rejects(() => pending, safeError(504));
    assert.equal(signal?.aborted, true);
  }
});

test("the deadline also aborts and cancels a stalled response body after text arrives", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const adapter of adapters) {
    let signal: AbortSignal | null | undefined;
    let cancelled = false;
    let sawText!: () => void;
    const textReceived = new Promise<void>((resolve) => { sawText = resolve; });
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(streamPrefix(adapter.id, "partial"))); },
      cancel() { cancelled = true; },
    });
    const provider = new adapter.Provider(KEY, async (_url, init) => {
      signal = init?.signal;
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    });
    const pending = (async () => { for await (const _chunk of provider.stream(input)) sawText(); })();
    await textReceived;
    t.mock.timers.tick(14_999);
    assert.equal(signal?.aborted, false);
    t.mock.timers.tick(1);
    await assert.rejects(() => pending, safeError(504));
    assert.equal(signal?.aborted, true);
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  }
});

test("consumer early-stop cancels and aborts upstream for every provider", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const adapter of adapters) {
    let signal: AbortSignal | null | undefined;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(streamPrefix(adapter.id, "first chunk"))); },
      cancel() { cancelled = true; },
    });
    const provider = new adapter.Provider(KEY, async (_url, init) => {
      signal = init?.signal;
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    });
    for await (const chunk of provider.stream(input)) { assert.equal(chunk, "first chunk"); break; }
    assert.equal(cancelled, true);
    assert.equal(signal?.aborted, true);
    assert.equal(body.locked, false);
    // The disposed deadline cannot create a later background failure.
    t.mock.timers.tick(15_000);
  }
});
