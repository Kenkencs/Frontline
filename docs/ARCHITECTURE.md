# Architecture walkthrough

## One conversation flow, exactly 1 + 2 agents

```text
React chat / Action Cards
       ↓ POST /api/chat
Backend validates role + approved provider/model pair
       ↓
Main Agent / Orchestrator
       ├─ Knowledge Agent: current documents → matching excerpts
       └─ Risk Agent: situation + evidence → required steps / escalation
       ↓
       ├─ Demo: local synthesis, no provider call
       └─ Live: AIProvider.structuredGenerate(context + assessment)
       ↓
Main Agent checks citations, risk, confidence, and required actions
       ↓
Validated ChatResponse → message or completed Action Card
```

These are three ordinary modules, not three autonomous model conversations. `server/agents/mainAgent.ts` coordinates `retrieveKnowledge()` in `server/knowledge/retrieve.ts`, then `assessRisk()` in `server/agents/riskAgent.ts`. The risk decision sees the retrieved evidence before synthesis. Demo and live paths share this sequence and final checks; only live synthesis makes a paid provider request.

`shared/chat.ts` defines one frontend/backend contract. `type` selects an ordinary message or an Action Card. `shared/validation.ts` checks remote JSON at runtime, including 1–8 nonempty actions; TypeScript types alone cannot validate an HTTP response. `shared/catalog.ts` allowlists four demo and four live model choices. Demo IDs bypass provider construction and never silently become live calls. Live failures never switch providers or become demo answers.

## Incremental status

| Increment                       | Source implementation                                                 | Live/deployment status                                        |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Frontend, demo, Action Cards | Complete; new demo sends now use the real local agent pipeline        | Does not need a provider                                      |
| 2. Common backend API           | Complete; Node and Worker share one handler                           | Existing Site publication predates these later source changes |
| 3. One OpenAI provider          | Implemented                                                           | Earlier connection timed out; real output unverified          |
| 4. Provider abstraction         | Implemented                                                           | Independent of connectivity and secret configuration          |
| 5. Other providers              | Claude, DeepSeek, and Kimi implemented                                | Their keys are not configured; real output unverified         |
| 6. Knowledge Agent / RAG        | Local lexical retrieval and policy-version checks implemented         | Default documents are fictional samples                       |
| 7. Risk Agent                   | Rule-based operational assessment and common final guards implemented | Rules are a limited classifier, not a safety certification    |

All four adapters also implement provider text streaming. `/api/chat` uses completed structured generation, not streaming. Source implementation and fake-response tests do not establish live API compatibility, real policy approval, or a new deployment. See [VERIFICATION.md](VERIFICATION.md) for actual checks and receipts.

## HTTP and frontend boundary

```text
Local:  React / Vite → /api proxy → Node adapter ┐
                                                ├→ handleApiRequest
Hosted: React assets → /api routes → Worker     ┘
```

`server/api.ts` is the shared Fetch handler. `server/nodeServer.ts` converts Node HTTP into Fetch requests/responses; `server/dev.ts` binds the local backend to loopback port 3001. `server/worker.ts` delegates API routes to the same handler and other requests to frontend assets. Vite proxies `/api`, so the browser calls its own origin.

`POST /api/chat` accepts a nonblank message of at most 4,000 characters, supported employee role, and allowlisted provider/model pair. It reads at most 32 KiB of JSON, reconstructs the known fields, calls the Main Agent, validates the result, and returns JSON with `Cache-Control: no-store`. The selected live provider comes from the small registry factory; the handler contains no provider-specific payloads.

`GET /api/knowledge` calls the same `getCurrentDocuments()` selector used by retrieval. It returns current document metadata and source sections, optionally filtered by `employee_role`. `src/services/knowledgeClient.ts` validates the returned catalog, and `KnowledgePage.tsx` renders it. Policy content stays in the backend dataset rather than a separate frontend copy.

`src/services/chatClient.ts` handles HTTP errors, a 20-second browser timeout, and response validation. Conversation pending/error states belong to each chat; retry keeps the original question, role, and model. React owns session-only conversations and manager drafts. Only one question is sent to the backend; neither provider nor backend receives visible chat history.

## Knowledge Agent: simple retrieval with version checks

`server/knowledge/documents.ts` contains the editable SOP dataset; `types.ts` defines document identity, positive integer revision, display version, approval status, UTC effective/review dates, roles, sample flag, and source sections. The supplied food-safety, allergen, opening, customer-care, and emergency examples are all fictional. The older retired food-safety revision demonstrates version handling.

`getCurrentDocuments()` selects the highest **already-effective non-draft revision per document ID**, including retired revisions, before checking approval, expiry, roles, or keywords. It then accepts only an approved, unambiguous revision with valid metadata, a review date on or after the current UTC day, and an allowed role. Thus a retired or overdue latest policy cannot cause an older approved version to reappear. A future revision leaves the currently effective revision available until its effective day; a draft does not replace approved policy. Duplicate revisions and invalid dates fail closed.

`retrieveKnowledge()` normalizes query/keyword terms, removes common English stop words, scores exact meaningful keyword matches, and returns at most four nonempty excerpts. Multiword keywords require all their terms. Stable source IDs include document identity, revision, and section identity; titles, versions, section labels, and excerpts come directly from the dataset. There are no embeddings, vector database, generated source documents, or paid retrieval calls.

This is lexical RAG: retrieved context is supplied to live generation. It can miss synonyms or unsupported languages; no match becomes missing evidence. The Risk Agent can still detect a hazard when retrieval misses its wording.

`KnowledgeResult` returns sources, used-document metadata, a `missing` flag, and `mode: "sample" | "company" | "none"`. Company mode requires every selected document to have explicit `sample: false`; mixed evidence is conservatively sample. Marking a record approved/company is maintained project data, not proof of an approval process. The [README](../README.md#replace-the-sample-knowledge) explains how to replace documents without reviving old policy.

## Risk Agent and application-owned actions

`assessRisk()` is a small deterministic policy classifier. English and Chinese patterns detect listed allergy, immediate-danger, safety-hazard, food-safety, payment/refund, difficult-customer, and permission questions. These rules set a minimum risk, whether an Action Card is required, manager escalation, confidence limit, a short reason, and required actions. Negated wording does not remove a hazard trigger: the worker's wording cannot verify food safety.

Allergy and safety triggers produce high risk, including recognized questions such as “Is this cake safe to eat?” without an allergy term; payment/refund/complaint triggers produce medium risk. Immediate-danger steps precede document checks. Detected permission questions always require an Action Card and manager verification, even with matching current company evidence. Retrieving a policy does not establish a worker's authority to change it or make an exception. Missing or sample evidence requires manager verification even for ordinary replies. Confidence is capped at low without current company evidence and medium with it; the MVP never claims high confidence in real policy or product safety.

The Main Agent rejects a response that lowers the assessed risk, exceeds the confidence cap, omits required escalation, or uses a message when an Action Card is required. Cards required by the risk assessment, any medium/high-risk cards, and all cards with sample or missing evidence use application-owned summaries and conservative steps. This includes low-risk permission questions regardless of evidence mode, and other low-risk cards without current company evidence. A provider cannot substitute an ingredient guarantee, medical diagnosis, or permission to issue a refund.

For ordinary replies with missing or sample evidence, the Main Agent replaces provider-written content with its own retrieved excerpts or missing-evidence clarification, followed by required manager-verification text. A sample match therefore cannot support an unconstrained provider claim. Ordinary replies with current company evidence can retain provider-generated wording.

These checks enforce a limited operational procedure. Lexical matching can miss synonyms, unfamiliar wording, or languages outside the listed patterns; it does not understand every possible danger or permission request. Low risk means no listed hazard trigger was detected, and can still require escalation for permission or missing evidence. The system does not verify product ingredients, diagnose conditions, authenticate worker authority, or establish that an action is safe.

## Main Agent: synthesis and canonical citations

Live synthesis receives the role, current question, retrieved excerpts, and risk assessment, with a 1,200-token output budget. The prompt treats user text and retrieved policy text as data; neither is allowed to override application rules. Demo synthesis uses the retrieved excerpts and required actions directly and makes no model call.

Every provider returns a root object containing `{ response: message | action }`. `server/responseSchema.ts` describes that envelope; the Main Agent's parser unwraps it into the existing `ChatResponse`. Common runtime validation remains authoritative even when an API enforces JSON schema.

Final citation checks allow at most four unique source IDs. Each cited ID must exist in this retrieval result and its title, version, section, and excerpt must match exactly. Invented, duplicate, or rewritten citations cause an error. The backend copies canonical retrieved records and assigns `Source.sample` itself. Only explicit `false` denotes company evidence; an omitted flag on a legacy fixture remains fictional in the UI. Mixed sample/company retrieval receives sample labeling throughout.

If a valid Action Card contains no citations, the Main Agent attaches its actual retrieved sources; it never fabricates a missing document. Application-owned required steps are applied after synthesis, so a model response does not become the source of operational permission. The result is validated again before reaching React.

## Provider transport stays separate from workplace rules

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

`ProviderInput` has `model`, `systemPrompt`, `prompt`, and optional `maxOutputTokens`. `OutputSchema<T>` combines a name, JSON schema, and application runtime parser. The interface contains no workplace types, secrets, or provider SDK types. The adapters translate these plain inputs into native HTTP requests. `registry.ts` has one explicit case per provider and a backend `apiKeys` map; no plugin loader, inheritance tree, or dependency-injection framework is needed.

- **OpenAI:** `gpt-4.1-mini`, `POST https://api.openai.com/v1/responses`, Bearer authentication, `store: false`, and `max_output_tokens`. Structured generation uses `text.format` with a named strict JSON schema. [Official structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- **Claude:** `claude-haiku-4-5-20251001`, `POST https://api.anthropic.com/v1/messages`, `x-api-key`, API-version header, and `max_tokens`. Structured generation uses `output_config.format`. The adapter removes unsupported bounds from a schema copy; the original parser and application checks still apply. Thinking is not enabled. [Official structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Haiku 4.5](https://platform.claude.com/docs/en/models/haiku-4-5/overview)
- **DeepSeek:** `deepseek-flash`, `POST https://api.deepseek.com/chat/completions`, Bearer authentication, `thinking: { type: "disabled" }`, and `max_tokens`. Structured generation requests `json_object` and includes our schema in the prompt, without claiming strict API schema enforcement. [Official Chat API](https://api-docs.deepseek.com/api/create-chat-completion/), [JSON mode](https://api-docs.deepseek.com/guides/json_mode/)
- **Kimi:** `kimi-k2.6`, `POST https://api.moonshot.ai/v1/chat/completions`, Bearer authentication, disabled thinking, and `max_completion_tokens`. It uses JSON-object mode and the original runtime parser. The global endpoint needs a corresponding global key; regions are not switched automatically. [Official Chat API](https://platform.kimi.ai/docs/api/chat), [JSON mode](https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api)

`request.ts` shares native `fetch`, backend authentication, the 15-second deadline, safe errors, and JSON/SSE transport. `chatCompletion.ts` shares JSON prompting and completed-output parsing for DeepSeek/Kimi. Completed-output parsing rejects unfinished or refused replies and accepts text rather than reasoning or tool arguments. `OutputSchema.parse` validates application fields; there is no general-purpose JSON Schema validator.

All four `stream()` methods yield text deltas using their provider's server-sent events. `sse.ts` handles framing, split UTF-8/chunks, event bounds, cancellation, and reader cleanup; adapters check provider completion markers. The deadline continues through body consumption, and stopping iteration aborts the request. Streaming can yield text before a later refusal/error, so a caller must not treat chunks as a final validated result. `/api/chat` deliberately calls `structuredGenerate()` and returns only a completed response.

Streaming uses the official provider formats: [OpenAI Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Claude streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [DeepSeek Chat streaming](https://api-docs.deepseek.com/api/create-chat-completion/), and [Kimi Chat streaming](https://platform.kimi.ai/docs/api/chat). Fake-response tests check framing, completion, refusal, timeout, and cancellation; real provider streams remain unverified.

## Secret, error, and deployment boundaries

React talks only to the backend. Node loads the ignored `.env` and maps `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, and `KIMI_API_KEY` into backend configuration. The Worker reads its runtime secret bindings. `.env.example` contains empty names; local secrets are excluded from source, builds, and deployment archives. Keys never belong in frontend Settings, catalog entries, `VITE_` variables, logs, or error responses.

An OpenAI key was created through the approved secure workflow and saved locally. Additional provider keys are unconfigured. Missing/authentication configuration returns `503`, provider usage limits `429`, refusal `422`, deadline expiry `504`, and unusable output/network failure `502`. Messages are application-written and sanitized; raw upstream bodies, keys, and worker questions are not returned. Other internal failures use a generic `500`.

Live validation and secure hosted-secret handoff are still separate pending work. A local source checkpoint does not publish the MVP or activate its live models. The hosted build keeps the existing private Site audience and Worker/assets structure; consult verification receipts for what is actually published.

The student MVP intentionally uses session-only history, read-only backend document data, and copy/save manager drafts. It has no document uploads, authenticated employee/company access, database, real notifications, or streaming chat UI. The role dropdown is context, not authorization. Introducing those features would require a separate, explicit scope decision; the current 1+2 module structure does not require them.
