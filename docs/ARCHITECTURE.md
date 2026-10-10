# A small architecture, built one increment at a time

## What exists now

```text
React components
       ↓
sendChat(ChatRequest)
       ↓ POST /api/chat
Backend validates input
       ↓ checks the approved model selection
       ├─ Demo model → getMockResponse(request)
       └─ Live GPT  → generateChat(request, AIProvider)
                            ↓
                     OpenAIProvider → OpenAI Responses API
       ↓
Validated ChatResponse → ordinary message or Action Card
```

`shared/chat.ts` defines the contract once. `type` tells React whether to render a plain message or an Action Card. Sources carry an ID, title, version, section, and excerpt. `shared/validation.ts` checks incoming JSON at runtime; TypeScript alone cannot validate an HTTP response.

`shared/catalog.ts` lists four demo provider/model pairs and one live OpenAI model, `gpt-4.1-mini`. Each entry has a `mode` of `demo` or `live`. The backend rejects unknown or mismatched selections instead of trusting arbitrary IDs. Demo IDs always use fixtures, even when a backend key exists; selecting live GPT never silently falls back to a demo or another provider.

`shared/demoResponses.ts` contains static examples for initial history; new sends always go over HTTP. The frontend contains no response generator. Increments 3 and 4 are implemented in source: one OpenAI integration and a small provider interface. A key was securely saved to the approved local `.env`, but a real OpenAI reply is still unverified because outbound requests time out before receiving an API response. Hosted secret handoff is also pending, so the published Site remains on increment 2. The abstraction could be developed independently of those unchanged connectivity and hosting blockers.

## Increment 2: one handler, two thin adapters

```text
Local:  React / Vite → /api proxy → Node HTTP adapter ┐
                                                     ├→ handleApiRequest
Hosted: React assets → /api/chat → Worker adapter    ┘
```

The two adapters are necessary because local development uses Node while the existing hosted site runs Cloudflare Workers. They share `server/api.ts`; neither contains workplace or provider logic. This preserves the React UI without introducing a new framework.

- `server/api.ts` accepts `POST /api/chat`, reads up to 32 KiB, validates fields, selects the demo or live path, validates the reply, and returns JSON with `Cache-Control: no-store`.
- `server/nodeServer.ts` converts Node HTTP requests/responses to the Fetch API used by the handler. `server/dev.ts` binds it to loopback port 3001.
- `server/worker.ts` sends API routes to the same handler and other requests to the frontend assets binding. Private access remains enforced by Sites.
- `vite.config.ts` proxies `/api` during development and preview. The browser calls only its own origin, so no broad CORS setup is needed.
- `src/services/chatClient.ts` uses `fetch`, a 20-second timeout, HTTP error handling, and runtime response validation. It never silently falls back to fixtures.
- `src/App.tsx` keeps pending/errors per conversation. Retry retains the originating role/model/question and adds no duplicate worker message.

The request stays simple:

```json
{
  "message": "Customer is allergic to peanuts. What should I do?",
  "employee_role": "waiter",
  "provider": "openai",
  "model": "demo-gpt"
}
```

The backend checks nonblank messages of at most 4,000 characters, employee role, and the approved provider/model pair. It reconstructs known fields and ignores arbitrary extra properties. Input, body, method, and route errors use `{ "error": "message" }` with an appropriate HTTP status. Internal errors use a sanitized `500`. Worker questions and internal errors are not logged or returned.

Responses remain the existing `ChatResponse`. Changing the backend implementation will not require rewriting the cards. Conversation history and drafts live only in React memory; the API receives one question and has no conversational memory. Add bounded history or a conversation ID deliberately when implementing follow-ups.

## Increments 3–4: one provider behind a small interface

```text
POST /api/chat with provider: "openai", model: "gpt-4.1-mini"
       ↓
server/api.ts validates the request and selects the live path
       ↓
createProvider("openai", backend config) → OpenAIProvider
       ↓
server/chat.ts calls AIProvider.structuredGenerate(...)
       ↓
OpenAIProvider → native fetch → OpenAI Responses API
       ↓
{ response: message | action } from a strict JSON schema
       ↓ unwrap, validate, check evidence rules
The same ChatResponse used by the demo → React
```

The responsibilities are split into small files:

- `server/providers/AIProvider.ts` defines plain application types and the common `generate`, `structuredGenerate`, and `stream` methods. It also defines `ProviderError`, which carries a safe application-written message and HTTP status. No SDK types or environment variables appear in the interface.
- `server/providers/OpenAIProvider.ts` translates those types into an OpenAI Responses API call using native `fetch`. It handles authentication, the 15-second timeout, HTTP errors, refusals, incomplete responses, and output extraction. Plain `generate` returns text; `structuredGenerate` parses JSON and invokes the supplied schema parser. It requests `store: false`. There is no provider SDK or agent framework.
- `server/providers/registry.ts` is a simple factory with an explicit OpenAI case. Backend configuration has an `apiKeys` object keyed by `ProviderId`. Unsupported live providers raise a safe `501` error. Demo requests bypass the factory entirely.
- `server/chat.ts` owns the workplace prompt, the output schema parser, and the common evidence checks. It calls only the `AIProvider` interface and limits the chat output to 1,200 tokens. The API handler chooses a provider through the factory; it contains no OpenAI request code.
- `server/responseSchema.ts` describes the two possible response shapes. The schema has an object at its root, with the message/action union nested under `response`. Its parser in `chat.ts` unwraps that envelope into the existing `ChatResponse`, so the frontend contract does not change.

A small interface is enough:

```ts
interface ProviderInput {
  model: string;
  systemPrompt: string;
  prompt: string;
  maxOutputTokens?: number;
}

interface OutputSchema<T> {
  name: string;
  jsonSchema: Record<string, unknown>;
  parse(value: unknown): T;
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

`OutputSchema<T>` combines the provider-facing JSON schema with the application's runtime parser. TypeScript cannot establish that remote JSON is valid; `parse` must check it. The generic result lets future callers request another validated structure without adding workplace-specific types to the adapter.

Tests can pass a fake `fetch` through the factory's backend configuration to inspect an OpenAI request without a real API call. They can also provide an `AIProvider` directly to `generateChat`. No dependency-injection framework is needed.

The live path has no company documents or product records. Its schema and the shared checks in `chat.ts` require empty `sources` and low confidence for Action Cards. The demo cards still show clearly labeled fictional sample policies. Live GPT must not copy those sample citations or claim a policy was checked. Keeping these rules in `chat.ts` means future providers will receive the same checks.

The prompt asks for conservative guidance, including escalation for severe allergies and possible harm. The backend also rejects an Action Card marked high risk without escalation. These checks do not prove that every situation was classified correctly. Prompt instructions are not a Risk Agent; evidence retrieval and a separate risk evaluation remain later increments.

The upstream call has a 15-second abort timeout, inside the frontend's 20-second request timeout. Missing keys or authentication failures return `503`; usage limits return `429`; model refusals return `422`; timeouts return `504`; network failures and incomplete, malformed, or unusable upstream results return `502`. `server/api.ts` translates `ProviderError` into the common JSON error shape. The backend never forwards raw provider errors, headers, or keys. The UI retains the original question for retry.

Streaming is reserved in the interface but explicitly unsupported in `OpenAIProvider`: consuming the stream raises `ProviderError` with status `501`. `/api/chat` uses only complete structured responses. Enable streaming after the non-streamed live path is verified, and validate a complete Action Card before presenting it as actionable.

## The sequence we will follow

| Increment      | Change                                           | Small success check                                                    |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 1 — complete   | React, mock responses, Action Card               | Allergy example and sample sources render                              |
| 2 — complete   | Common HTTP endpoint; backend mock               | UI receives the same card over HTTP                                    |
| 3 — code ready | One backend-only OpenAI integration              | Network access, hosted secret, and a verified live reply               |
| 4 — code ready | Extract `AIProvider` from the OpenAI integration | Application logic depends on the interface; live path still unverified |
| 5              | Anthropic, DeepSeek, Kimi adapters               | Same contract works for every configured adapter                       |
| 6              | Knowledge Agent with company retrieval           | Accessible current document versions are cited                         |
| 7              | Risk Agent and Main Agent orchestration          | Uncertain or insufficient evidence causes escalation                   |

We explain decisions before implementing each increment. The additional provider adapters and the agents described below are **not implemented yet**.

## Increment 5: additional provider adapters

The common interface and OpenAI adapter already exist. After verifying the live path, add one adapter at a time for Anthropic, DeepSeek, and Kimi. This needs no frontend changes: the API still returns the same `ChatResponse`.

Proposed layout after increment 5:

```text
shared/chat.ts
src/                         # React only
server/
  api.ts                     # POST /api/chat, request validation
  providers/
    AIProvider.ts            # common interface
    OpenAIProvider.ts
    AnthropicProvider.ts
    DeepSeekProvider.ts
    KimiProvider.ts
    registry.ts              # simple provider factory
  chat.ts                    # provider-independent application logic
```

Each adapter translates these plain types into its provider’s API and validates the result. Native structured-output support varies, so adapters may need JSON parsing plus schema validation. Do not assume APIs, models, streaming formats, or JSON modes are identical. We will check the current official provider documentation when implementing each adapter.

Each new adapter needs one explicit factory case and an approved live model entry in `shared/catalog.ts`. The backend validates that catalog; no plugin loader or inheritance tree is needed. A missing key makes a provider unavailable with a clear message; it must not silently select another provider.

## API-key boundary

The current boundary is:

```text
React frontend
      ↓
Backend API (reads server environment only)
      ↓
AIProvider
      ↓
OpenAIProvider (the only live adapter implemented)
```

Only the backend reads keys. `server/dev.ts` loads the local `.env` using Node's environment-file loader and passes `process.env.OPENAI_API_KEY` as `apiKeys.openai`. The hosted Worker would pass its `OPENAI_API_KEY` environment binding through the same configuration. The local `.env` is not deployed. The real `.env` is ignored by Git, while `.env.example` contains names and empty values only.

The other provider key names are reserved for later adapters. Never prefix secrets with `VITE_`, put them in React, log them, or return them through an endpoint. A model appearing in the selector does not prove that its backend key is configured. The local OpenAI key was created with a 30-day expiration and is excluded from Git/build archives. Hosted activation needs a secure handoff into Sites' native secret setter, which currently has no file or encrypted-secret input. Live verification still needs working outbound access; demo choices work without a key.

Before real employee use, the backend will also need employee/manager identity, company-scoped document access, and sensible request limits. The role dropdown is context, not authentication or manager authorization. These are future deployment requirements.

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

Live Anthropic/DeepSeek/Kimi adapters, provider-side streaming, document uploads, RAG, version checking, a Risk Agent, application-level employee authentication, persistent conversations, real manager notifications, and an agent framework. The sample knowledge pages are UI prototypes; live OpenAI does not retrieve their contents.
