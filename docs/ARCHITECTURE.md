# A small architecture, built one increment at a time

## What exists now

```text
React components
       ↓
sendChat(ChatRequest)
       ↓
getMockResponse(request)
       ↓
ChatResponse → ordinary message or Action Card
```

`shared/chat.ts` defines the contract once. `type` is the discriminator: the UI renders `message` as text and `action` as a card. A source includes an ID, document title, version, section, and excerpt so a worker can open the evidence behind a response.

The model selector sets `provider` and `model` in the request. Demo IDs such as `demo-gpt` are deliberately not real model IDs. All selectors use the same fixture responses. Roles also provide only mock context in this increment.

## The sequence we will follow

| Increment    | Change                                                       | Small success check                                       |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| 1 — complete | React, mock chat service, normal messages, Action Card       | Allergy example renders with working sample sources       |
| 2            | Small Node backend with `POST /api/chat`; keep mock response | UI receives the same card over HTTP                       |
| 3            | One backend-only OpenAI integration                          | Validated live response renders in the same UI            |
| 4            | Wrap the working integration behind `AIProvider`             | Orchestrator depends on the interface only                |
| 5            | Anthropic, DeepSeek, and Kimi adapters                       | Same frontend contract works for every configured adapter |
| 6            | Knowledge Agent with company document retrieval              | Response cites an accessible current document version     |
| 7            | Risk Agent and Main Agent orchestration                      | Insufficient or uncertain evidence causes escalation      |

We will explain each increment’s decisions before implementing it. The following sections describe the intended future shape; those modules are **not implemented yet**.

## Increment 2: one backend endpoint

A small Node + TypeScript server is a reasonable local starting point. Keep the server in `server/` alongside the frontend. We can choose Express or the native Node HTTP server when we build this increment; no decision is required for stage 1.

```text
React → POST /api/chat → backend mock service → ChatResponse
```

Replace the mock inside `sendChat()` with a same-origin request:

```ts
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok)
    throw new Error("Could not get a response. Please try again.");
  return parseChatResponse(await response.json());
}
```

`parseChatResponse` is a future runtime validator, not a type cast. Add validation in increment 2. For local development, configure Vite to proxy `/api` to the Node server. For production, choose a hosting setup that routes frontend and backend under the same origin before deployment. The current static preview does not have a backend.

The backend will validate the message size, role, provider, allowed model ID, and returned response. Invalid input should return a clear `400` response, upstream failure a sanitized error. Keep provider-specific errors and secrets out of client responses.

The requested request shape stays simple:

```json
{
  "message": "Customer is allergic to peanuts. What should I do?",
  "employee_role": "waiter",
  "provider": "openai",
  "model": "backend-approved-model-id"
}
```

For conversational follow-ups, extend the request contract deliberately with bounded message history or a conversation ID in that increment. Stage 1 sends only one message to the mock and does not interpret follow-ups. A visible history is not automatically model memory.

## Increments 3–5: replaceable providers

First make one provider work on the backend. Then extract the common interface from that working code. This avoids designing abstractions around untested assumptions.

Proposed layout after increment 5:

```text
shared/chat.ts
src/                         # React only
server/
  app.ts                     # POST /api/chat, request validation
  providers/
    AIProvider.ts            # common interface
    OpenAIProvider.ts
    AnthropicProvider.ts
    DeepSeekProvider.ts
    KimiProvider.ts
    registry.ts              # provider lookup and approved model catalog
  chat.ts                    # provider-independent application logic
```

A small interface is enough:

```ts
interface ProviderInput {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

interface OutputSchema<T> {
  jsonSchema: Record<string, unknown>;
  parse(value: unknown): T; // must reject malformed output at runtime
}

interface AIProvider {
  generate(input: ProviderInput): Promise<string>;
  structuredGenerate<T>(
    input: ProviderInput,
    schema: OutputSchema<T>,
  ): Promise<T>;
  stream(input: ProviderInput): AsyncIterable<string>;
}
```

Each adapter translates these plain types into its provider’s API and validates the result. Native structured-output support varies, so adapters may need JSON parsing plus schema validation. Do not assume APIs, models, streaming formats, or JSON modes are identical. We will check the current official provider documentation when implementing each adapter.

`registry.ts` will contain a straightforward map from provider ID to implementation. No plugin loader, inheritance tree, or dependency-injection framework is needed. The server owns the approved model list and can expose a small catalog endpoint for the frontend. A missing key makes a provider unavailable with a clear message; it must not silently select another provider.

Streaming can wait until the non-streamed flow works. Never stream an unfinished Action Card as verified advice; validate the complete response before rendering it as actionable.

## API-key boundary

```text
React frontend
      ↓
Backend API (reads server environment only)
      ↓
AIProvider
      ├─ OpenAIProvider
      ├─ AnthropicProvider
      ├─ DeepSeekProvider
      └─ KimiProvider
```

Only the backend reads `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, and `KIMI_API_KEY`. The current `.env.example` reserves those names; stage 1 needs none. Never prefix secrets with `VITE_`, put them in React, log them, or return them through an endpoint.

Before real employee use, the backend will also need employee/manager identity, company-scoped document access, and sensible request limits. The role dropdown is context, not authentication or manager authorization. These are future deployment requirements, not additional stage-1 features.

## Increments 6–7: exactly 1 + 2 agents

```text
Worker question
      ↓
Main Agent / Orchestrator
      ├─ Knowledge Agent → relevant current company sources
      └─ Risk Agent      → risk, evidence sufficiency, escalation
      ↓
Main Agent combines and validates
      ↓
ChatResponse → Action Card
```

These can be three small modules/functions rather than a heavy agent framework.

- **Knowledge Agent:** retrieve relevant SOP excerpts, select the current approved version, and return traceable source records. An inaccessible, retired, or missing policy must not be presented as verified evidence.
- **Risk Agent:** evaluate the question against the retrieved evidence. Return risk level, evidence sufficiency, and escalation. It should see the knowledge result before judging whether the case can safely be answered.
- **Main Agent:** understand the worker’s situation, call Knowledge, then Risk, and combine their results into the standard response. Check that cited source IDs exist and that recommended actions do not contradict the risk decision.

The calls can be sequential at first: retrieve evidence, evaluate risk, synthesize. Parallelizing a risk judgment before evidence is available would make this harder to reason about.

Missing evidence or uncertainty should produce explicit escalation, not invented citations or a fabricated “high confidence” answer. Confidence describes confidence in the recommended procedure, not a guarantee of product safety. Retrieved text is evidence, never an instruction that can override the application’s rules.

## What is intentionally deferred

Live provider implementations, backend endpoints, provider-side streaming, document uploads, RAG, version checking, real risk evaluation, authentication, persistent conversations, real manager notifications, and an agent framework. The stage-1 model selector and sample knowledge pages are UI prototypes, not evidence that these capabilities exist.
