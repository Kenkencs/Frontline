# A small architecture, built one increment at a time

## What exists now

```text
React components
       ↓
sendChat(ChatRequest)
       ↓ POST /api/chat
Backend validates input
       ↓
getMockResponse(request)
       ↓
Validated ChatResponse → ordinary message or Action Card
```

`shared/chat.ts` defines the contract once. `type` tells React whether to render a plain message or an Action Card. Sources carry an ID, title, version, section, and excerpt. `shared/validation.ts` checks incoming JSON at runtime; TypeScript alone cannot validate an HTTP response.

All demo provider/model pairs are listed in `shared/catalog.ts`. The backend rejects unknown or mismatched selections instead of trusting arbitrary IDs. `shared/demoResponses.ts` contains static examples for initial history; new sends always go over HTTP. The frontend contains no response generator.

## Increment 2: one handler, two thin adapters

```text
Local:  React / Vite → /api proxy → Node HTTP adapter ┐
                                                     ├→ handleApiRequest → backend mock
Hosted: React assets → /api/chat → Worker adapter    ┘
```

The two adapters are necessary because local development uses Node while the existing hosted site runs Cloudflare Workers. They share `server/api.ts`; neither contains workplace or provider logic. This preserves the React UI without introducing a new framework.

- `server/api.ts` accepts `POST /api/chat`, reads up to 32 KiB, validates fields, calls the backend mock, validates the reply, and returns JSON with `Cache-Control: no-store`.
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

The backend checks nonblank messages of at most 4,000 characters, employee role, and the approved provider/model pair. It reconstructs known fields and ignores arbitrary extra properties. Errors use `{ "error": "message" }` with `400`, `413`, `415`, `405`, `404`, or a sanitized `500`. Worker questions and internal errors are not logged or returned.

Responses remain the existing `ChatResponse`. Changing the backend implementation will not require rewriting the cards. Conversation history and drafts live only in React memory; the API receives one question and has no conversational memory. Add bounded history or a conversation ID deliberately when implementing follow-ups.

## The sequence we will follow

| Increment    | Change                                            | Small success check                                  |
| ------------ | ------------------------------------------------- | ---------------------------------------------------- |
| 1 — complete | React, mock responses, Action Card                | Allergy example and sample sources render            |
| 2 — complete | Common HTTP endpoint; backend mock                | UI receives the same card over HTTP                  |
| 3            | One backend-only OpenAI integration               | Validated live reply renders in the same UI          |
| 4            | Extract `AIProvider` from the working integration | Application logic depends on the interface           |
| 5            | Anthropic, DeepSeek, Kimi adapters                | Same contract works for every configured adapter     |
| 6            | Knowledge Agent with company retrieval            | Accessible current document versions are cited       |
| 7            | Risk Agent and Main Agent orchestration           | Uncertain or insufficient evidence causes escalation |

We explain decisions before implementing each increment. The following sections describe future modules; they are **not implemented yet**.

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

Only the backend will read `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, and `KIMI_API_KEY`. The current `.env.example` reserves those names; increment 2 needs none. Never prefix secrets with `VITE_`, put them in React, log them, or return them through an endpoint.

Before real employee use, the backend will also need employee/manager identity, company-scoped document access, and sensible request limits. The role dropdown is context, not authentication or manager authorization. These are future deployment requirements, not additional increment-2 features.

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

Live provider implementations, provider-side streaming, document uploads, RAG, version checking, real risk evaluation, application-level employee authentication, persistent conversations, real manager notifications, and an agent framework. The demo model selector and sample knowledge pages are UI prototypes, not evidence that these capabilities exist.
