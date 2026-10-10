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
       └─ Live GPT  → generateOpenAIChat(request)
       ↓
Validated ChatResponse → ordinary message or Action Card
```

`shared/chat.ts` defines the contract once. `type` tells React whether to render a plain message or an Action Card. Sources carry an ID, title, version, section, and excerpt. `shared/validation.ts` checks incoming JSON at runtime; TypeScript alone cannot validate an HTTP response.

`shared/catalog.ts` lists four demo provider/model pairs and one live OpenAI model, `gpt-4.1-mini`. Each entry has a `mode` of `demo` or `live`. The backend rejects unknown or mismatched selections instead of trusting arbitrary IDs. Demo IDs always use fixtures, even when a backend key exists; selecting live GPT never silently falls back to a demo or another provider.

`shared/demoResponses.ts` contains static examples for initial history; new sends always go over HTTP. The frontend contains no response generator. Increment 3's code is implemented and a key was securely saved to the approved local `.env`. A real OpenAI reply is still unverified: outbound requests time out before receiving an API response. Hosted key setup is also pending, so the published Site remains on increment 2.

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

## Increment 3: one OpenAI call on the backend

```text
POST /api/chat with provider: "openai", model: "gpt-4.1-mini"
       ↓
server/api.ts validates the request and selects the live path
       ↓
server/openaiChat.ts → native fetch → OpenAI Responses API
       ↓
{ response: message | action } from a strict JSON schema
       ↓ unwrap, validate, check evidence rules
The same ChatResponse used by the demo → React
```

Two small files contain the new behavior:

- `server/openaiChat.ts` makes one non-streamed request with native `fetch`. It sends the employee role, current question, instructions, and output schema. It requests `store: false` and limits output to 1,200 tokens. There is no SDK, provider registry, or agent framework yet.
- `server/responseSchema.ts` describes the two possible response shapes. The schema has an object at its root, with the message/action union nested under `response`. The server unwraps that envelope before returning the existing `ChatResponse`, so the frontend contract does not change.

The API handler receives the key through a small options object. Tests can also pass a fake `fetch` implementation to check the upstream request and failure handling without a real API call. This is a test seam, not the future `AIProvider` abstraction.

The live path has no company documents or product records. Its schema and runtime checks require empty `sources` and low confidence for Action Cards. The demo cards still show clearly labeled fictional sample policies. Live GPT must not copy those sample citations or claim a policy was checked.

The prompt asks for conservative guidance, including escalation for severe allergies and possible harm. The backend also rejects an Action Card marked high risk without escalation. These checks do not prove that every situation was classified correctly. Prompt instructions are not a Risk Agent; evidence retrieval and a separate risk evaluation remain later increments.

The upstream call has a 15-second abort timeout, inside the frontend's 20-second request timeout. Missing keys or authentication failures return `503`; usage limits return `429`; model refusals return `422`; timeouts return `504`; incomplete, malformed, or unusable upstream results return `502`. The backend returns its own brief error messages and never forwards raw provider errors, headers, or keys. The UI retains the original question for retry.

## The sequence we will follow

| Increment      | Change                                            | Small success check                                      |
| -------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 1 — complete   | React, mock responses, Action Card                | Allergy example and sample sources render                |
| 2 — complete   | Common HTTP endpoint; backend mock                | UI receives the same card over HTTP                      |
| 3 — code ready | One backend-only OpenAI integration               | Network access, hosted secret, and a verified live reply |
| 4              | Extract `AIProvider` from the working integration | Application logic depends on the interface               |
| 5              | Anthropic, DeepSeek, Kimi adapters                | Same contract works for every configured adapter         |
| 6              | Knowledge Agent with company retrieval            | Accessible current document versions are cited           |
| 7              | Risk Agent and Main Agent orchestration           | Uncertain or insufficient evidence causes escalation     |

We explain decisions before implementing each increment. The following sections describe future modules; they are **not implemented yet**.

## Increments 4–5: replaceable providers

After validating the one-provider integration, extract its common interface. This avoids designing abstractions around untested assumptions.

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

The intended boundary after extracting the provider interface is:

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

Only the backend reads keys. In increment 3, `server/dev.ts` loads a local `.env` using Node's environment-file loader and passes `process.env.OPENAI_API_KEY` to the handler. The hosted Worker receives `OPENAI_API_KEY` through its backend environment binding; the local `.env` is not deployed. The real `.env` is ignored by Git, while `.env.example` contains names and empty values only.

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

The common provider interface, live Anthropic/DeepSeek/Kimi adapters, provider-side streaming, document uploads, RAG, version checking, a Risk Agent, application-level employee authentication, persistent conversations, real manager notifications, and an agent framework. The sample knowledge pages are UI prototypes; live OpenAI does not retrieve their contents.
