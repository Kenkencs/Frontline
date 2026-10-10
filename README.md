# Frontline Workplace Knowledge Agent

A small, conversation-first MVP for frontline workers. React sends a question to one backend API, which coordinates a **Main Agent, Knowledge Agent, and Risk Agent** and returns an ordinary message or a structured Action Card. GPT, Claude, DeepSeek, and Kimi share the same provider interface; changing the selected model does not change the frontend.

The complete demo flow works without a key or paid AI call. Live provider adapters and streaming methods are implemented, but real live responses remain unverified: the earlier OpenAI connection timed out, other provider keys are not configured, and secure hosted-secret handoff is pending. See [verification](docs/VERIFICATION.md) for the latest checks and deployment status.

## Run it

Use Node.js 22.12+ or a current supported LTS release.

```sh
npm install
npm run dev
```

This starts Vite and the Node backend. Open Vite's printed local URL, normally `http://127.0.0.1:5173`. Vite proxies `/api` to the loopback backend on port 3001. Ctrl+C stops both. Separate terminals can use `npm run dev:server` and `npm run dev:frontend`.

```sh
npm test
npm run build
npm run preview
```

Preview starts both processes; its frontend normally uses port 4173. The build produces `dist/client` for React and `dist/server/index.js` for the hosted Worker. Both backend adapters use the same API handler.

## Try the demo

Select any model labeled **demo**, then try:

- “Customer says she has a severe peanut allergy. Can she eat this cake?” — a high-risk Action Card with conservative steps, sample sources, low confidence, and manager escalation.
- “Opening shift checklist” — an ordinary message containing matching procedure excerpts.
- “Can I refund this customer?” — a medium-risk card requiring policy and authority checks.
- “Is this cake safe to eat?” — a high-risk card requiring exact-product verification, even without an allergy keyword.
- An unrelated question — an explicit missing-evidence response, without invented sources.

Demo sends use the same Knowledge Agent, Risk Agent, and final validation as live sends. Only the synthesis differs: demo mode composes the answer locally; live mode asks the selected provider for structured output. Demo models never call a provider, even if backend keys exist. Initial example conversations are static fictional fixtures; every new send uses the backend pipeline.

**Knowledge Base** loads the backend's current approved catalog for the selected role. **View Source** displays the exact retrieved excerpt and its sample/company label. **Ask Manager** lets you edit or copy a note, or save a session draft to Manager Dashboard; nothing is sent to another person.

Conversations and drafts live in React memory and reset on reload. Only the current question is sent, so visible history is not model memory. Failed live requests stay visible and never become demo answers or switch providers. Retry keeps the original role, model, and question without duplicating the worker message.

## Read the code in this order

Follow one question through these small modules:

1. `shared/chat.ts` and `shared/validation.ts`: request/response types and runtime checks. `shared/catalog.ts` allowlists model choices and distinguishes demo from live.
2. `src/services/chatClient.ts` and `server/api.ts`: browser HTTP transport, input validation, model selection, and safe JSON errors.
3. `server/agents/mainAgent.ts`: retrieve evidence, assess risk, synthesize, and validate the final response. `server/chat.ts` is a thin entry point for existing live callers.
4. `server/knowledge/types.ts`, `documents.ts`, and `retrieve.ts`: editable SOP data, current-version selection, and local keyword retrieval.
5. `server/agents/riskAgent.ts`: simple operational-risk rules, required actions, confidence limits, and escalation.
6. `server/providers/AIProvider.ts` and `registry.ts`: the common contract and explicit adapter factory.
7. The four provider files, followed by `request.ts`, `chatCompletion.ts`, and `sse.ts`: native HTTP requests, provider output formats, shared errors, and streaming transport.
8. `server/responseSchema.ts`: the provider-facing JSON envelope. The Main Agent unwraps it into the unchanged `ChatResponse`.
9. `src/components/ActionCard.tsx`, `KnowledgePage.tsx`, and `WorkspaceDialogs.tsx`: cards, the read-only catalog, source viewing, and manager drafts. `src/App.tsx` owns conversation state.
10. `server/dev.ts`, `nodeServer.ts`, and `worker.ts`: local and hosted adapters. `tests/` exercises the boundaries with fake providers and fake HTTP responses.

There is no provider SDK, agent framework, database, vector store, application router, or extra state library. The [architecture walkthrough](docs/ARCHITECTURE.md) explains how the modules fit together.

## Replace the sample knowledge

Edit **`server/knowledge/documents.ts`** on the backend. All included SOPs are fictional samples; their approval metadata demonstrates the software's version rules. They cannot establish an actual company's procedure or a product's ingredients.

Each `KnowledgeDocument` contains:

| Field              | Meaning                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `documentId`       | Stable identity shared by every revision of one policy                 |
| `revision`         | Positive integer used to select the latest revision                    |
| `title`, `version` | Human-readable citation labels                                         |
| `status`           | `draft`, `approved`, or `retired`                                      |
| `effectiveFrom`    | First effective day, in `YYYY-MM-DD` UTC                               |
| `reviewBy`         | Last usable day, inclusive, in `YYYY-MM-DD` UTC                        |
| `roles`            | Allowed `waiter`, `cashier`, and/or `kitchen_staff` roles              |
| `sample`           | `true` for fictional/example evidence                                  |
| `sections`         | Stable section ID, section label, exact excerpt, and matching keywords |

Use `sample: false` only after replacing the sample content with actual company documents and checking their approval, dates, roles, and versions. The code trusts this maintained metadata; it cannot prove that a person approved a document. The `sampleDocument()` helper always creates samples, so real documents should have an explicit `KnowledgeDocument` record.

When a policy changes, use the same `documentId` with a higher integer revision and the new approved content and dates. Do not relabel copied old text as a new policy. The highest already-effective non-draft revision is selected **before** expiry, role, or keyword filtering. If it is retired, overdue, or unavailable to the role, older approved text is not revived. A future revision does not replace the current revision until its effective day. Duplicate revisions and invalid dates are excluded. Expired sample policies also stop appearing until properly reviewed.

Retrieval matches normalized keyword terms and returns at most four excerpts. Add meaningful keywords and explicit variants such as `allergy` and `allergic`; this is simple lexical retrieval, not semantic search. A missed match produces missing evidence. There are no document uploads or browser-side policy editing.

Sample or missing evidence caps Action Card confidence at **low**. Current company evidence caps it at **medium**. A mixed sample/company result is treated as sample. Confidence describes procedural evidence, never whether a cake is safe. A keyword match is evidence of relevant text, not permission to act. Detected permission questions always require an Action Card and manager verification, even when a current company policy matches.

Required-action cards and all cards with sample or missing evidence use application-owned verification steps and summaries, including low-risk cards. An AI reply cannot replace those steps with refund permission, a safety guarantee, or a diagnosis. Ordinary replies with sample or missing evidence also use application-owned excerpts or clarification text plus manager verification, rather than unchecked provider prose. Current-company ordinary replies can use provider-generated wording. The lexical risk rules remain incomplete: an unfamiliar phrase can miss a trigger, and a low-risk label does not establish safety or authority.

## Model providers

```ts
interface AIProvider {
  generate(input: ProviderInput): Promise<string>;
  structuredGenerate<T>(
    input: ProviderInput,
    schema: OutputSchema<T>,
  ): Promise<T>;
  stream(input: ProviderInput): AsyncIterable<string>;
}
```

`ProviderInput` contains `model`, `systemPrompt`, `prompt`, and optional `maxOutputTokens`. `OutputSchema` contains a name, JSON schema, and runtime parser. Neither contains keys or SDK types. The Main Agent calls `structuredGenerate()` and applies the same evidence/risk checks to every adapter.

| Provider  | Live model ID               | Backend variable    | Structured output                                       |
| --------- | --------------------------- | ------------------- | ------------------------------------------------------- |
| OpenAI    | `gpt-4.1-mini`              | `OPENAI_API_KEY`    | Native strict JSON schema                               |
| Anthropic | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` | Native JSON schema adapted to Claude's supported subset |
| DeepSeek  | `deepseek-flash`            | `DEEPSEEK_API_KEY`  | JSON-object mode plus schema prompt and runtime parsing |
| Kimi      | `kimi-k2.6`                 | `KIMI_API_KEY`      | JSON-object mode plus schema prompt and runtime parsing |

OpenAI uses [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Claude's adapter removes unsupported bounds from a copy of the API-facing schema; the original parser and common checks still enforce limits such as eight actions. [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

[DeepSeek JSON mode](https://api-docs.deepseek.com/guides/json_mode/) and [Kimi JSON mode](https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api) constrain JSON syntax; these adapters do not claim strict API enforcement of our complete schema. DeepSeek and Kimi explicitly disable thinking. Completed-output parsing never presents reasoning or tool arguments as the answer. Kimi uses the global `api.moonshot.ai` endpoint.

All four `stream()` implementations yield text chunks from server-sent events. Streaming is a provider capability, not the chat endpoint's response format: **`POST /api/chat` remains nonstreamed** and returns a completed, validated message or Action Card. Partial text has not passed the Main Agent's final checks and must not be rendered as a verified card. Stream parsing has fake-response coverage; real provider streaming is unverified.

## API

Try the complete demo backend without a key:

```sh
curl http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Customer has a peanut allergy","employee_role":"waiter","provider":"openai","model":"demo-gpt"}'

curl 'http://127.0.0.1:3001/api/knowledge?employee_role=waiter'
```

`POST /api/chat` accepts `message`, `employee_role`, `provider`, and `model`. Accepted pairs are in `shared/catalog.ts`. Successful replies are either `{ type: "message", content, sources }` or `{ type: "action", risk, summary, actions, sources, confidence, escalate }`.

A source contains `id`, `title`, `version`, `section`, `excerpt`, and an optional `sample` flag. The backend checks citations against the retrieved records and assigns the flag itself. Only explicit `sample: false` denotes company evidence; omitted flags on legacy example fixtures remain fictional.

`GET /api/knowledge` returns current approved documents and their sections. The optional `employee_role` filters the catalog; omitting it returns the current catalog across roles. It uses the same current-version selector as chat retrieval and does not call an AI provider.

Errors use `{ "error": "message" }`. Validation failures return `400`, oversized bodies `413`, non-JSON chat input `415`, wrong methods `405`, and unknown routes `404`. Live failures use safe messages: configuration/authentication `503`, usage limits `429`, refusal `422`, timeout `504`, and unusable output/network failure `502`. Internal failures return a sanitized `500`.

## Keys and deployment

Only backend environment variables hold provider keys. Node loads the ignored local `.env`; `.env.example` contains empty variable names. Worker deployments receive server-side runtime secrets. Local `.env` files are never deployed, and keys never belong in React, frontend Settings, `shared/catalog.ts`, `VITE_` variables, or build metadata. Missing selected-provider keys return `503` before a provider call.

An OpenAI key was provisioned through the approved secure workflow and saved locally. No additional provider keys were created for this MVP. Live validation still needs working outbound access and backend configuration; secure local-file-to-hosted-secret handoff remains pending. These source changes do not themselves update the published Site.

The hosted build uses a Cloudflare Worker and its [static-assets binding](https://developers.cloudflare.com/workers/static-assets/binding/). Its existing private Site audience is preserved. The role selector provides answer context, not authenticated employee identity or manager authority. This MVP has no persistent storage, company access control, real manager notifications, or streaming chat UI. Review the [verification record](docs/VERIFICATION.md) before treating it as a workplace deployment.
