# Current MVP status

The `1.1.1` source improves response wording and separates routine guidance questions from permission requests. It retains the role-specific FAQs, persistent question review, retrieval, and emergency manager-contact panel from `1.1.0`. The latest publication receipt is maintained beside the source in `frontline-deployment.md`.

The records below are historical. The latest release sections supersede earlier statements about deferred code, storage, and deployment. Live providers remain unverified and hosted API keys remain unconfigured.

## Response wording update — 1.1.1

Checked on 11 October 2026:

- Routine questions such as “What should I do?” no longer automatically count as requests to change a procedure. Each permission phrase is checked separately, so a routine opening clause cannot hide a later request to skip, override, or change a rule.
- All 36 curated FAQs have no occurrence of the old generic manager-verification summary. Their response distribution is 30 ordinary messages, five medium-risk cards for money/transaction issues, and one high-risk contamination card.
- Refund, receipt, payment, cash, and complaint cards have specific summaries and application-owned steps. A receipt-printer paraphrase without the word “payment” correctly retrieves the Cashier FAQ and keeps transaction verification.
- Ordinary sample guidance retains source citations and one short sample reminder. Missing evidence, genuine permission decisions, allergies, emergencies, and recognized hazards preserve escalation. Provider-generated unsafe claims cannot replace application-owned sample guidance.
- All **142 tests passed**, along with the production React/Worker build and TypeScript checks. Tests use fake upstreams; no paid model request was made.
- Local browser QA verified the delayed-order question as an ordinary source-backed reply, and “The receipt printer is not printing. What should I do?” as a receipt-specific Action Card with the Cashier sample source. The screenshot beside the source records the ordinary reply. The layout did not change; no new device/accessibility matrix was run.

Production UI interactions were not independently reverified; prior automated access was blocked at the private site's edge. Native deployment results and local behavior checks are recorded separately from owner verification.

# Increment 1 verification

Completed on 9 October 2026:

- Dependency installation completed; the installer reported zero known vulnerabilities.
- `npm run typecheck` passed.
- `npm run build` passed, including TypeScript checking and Vite’s production bundle.
- A local HTTP check returned the application page successfully.
- Browser rendering showed the allergy Action Card with risk, situation, four actions, sources, confidence, and escalation controls.
- **View Source** opened the Food Safety SOP’s actual fictional excerpt.
- **Ask Manager** opened an editable draft containing the originating question and role, with an explicit “nothing is sent” notice.
- **Save draft** produced a confirmation, and the draft appeared in Manager Dashboard marked “Not sent.”
- Selecting Claude changed the model selector; a new opening-shift question produced an ordinary reply labeled “Claude · Demo response,” with its sample source.
- The narrow layout’s sidebar opened and closed, and **New conversation** displayed its empty state.
- A final browser check changed the selected role to Cashier, then opened the existing allergy card’s escalation draft. The draft correctly retained its original Waiter role and question.
- A source review found and fixed the older-card escalation-context bug and stale “Copied” state after editing. Workspace pages and native dialogs were separated from application coordination for readability.
- Source inspection confirmed no frontend provider API calls, no environment reads, and no real API keys. The only key names are the empty backend placeholders in `.env.example`.

Limits: browser checks used the in-app browser’s narrow viewport. A full desktop/mobile device matrix, 200% text enlargement, clipboard copying, and every secondary-page interaction were not exhaustively checked. Browser control was unstable during part of the checks; the native controls subsequently verified the core flows listed above.

Increment 1 did not include backend checks. Live AI, RAG, real policy-version checks, real risk evaluation, and manager delivery remain deferred.

On 9 October, private Sites publication was blocked by automatic approval review because the external source upload had not been explicitly authorized. On 10 October, the user approved that upload and private publication. The confirmed deployment result and live link are provided in the chat handoff.

# Increment 2 verification

Completed on 10 October 2026:

- Cached, pinned development dependencies installed successfully after the npm registry timed out. The installer reported zero known vulnerabilities.
- TypeScript checks include the frontend, shared contracts, backend, and tests.
- All 14 tests passed with Node’s built-in test runner: real HTTP action and ordinary replies; every demo provider/model pair; invalid fields; malformed JSON; non-JSON content; unknown routes; wrong methods; ordinary and chunked oversized uploads; client HTTP/network errors; malformed responses; timeout; and Worker API/asset routing.
- The production build created separate React assets and a self-contained Worker ES module. The old static-only output is cleaned on each build.
- A direct check imported the built Worker and verified its real `POST /api/chat` response.
- A local HTTP check verified the frontend and a Claude demo request through Vite’s proxy.
- Browser checks sent a new ordinary question and a new severe-peanut-allergy question through the backend. Both rendered correctly, with Claude selected.
- The owned local backend was briefly paused and then restored. The browser showed a pending request only in its originating conversation; another conversation remained usable. The first request timed out with an inline retry button.
- After the backend was restored, a new question succeeded while the older failed request remained available. Retry produced the complaint Action Card without duplicating the worker question.
- The retried card’s manager draft retained its original Waiter role and question after the role selector had changed to Cashier.
- Source review confirmed new response generation lives only in `server/mockChat.ts`. React calls only `/api/chat`; no provider endpoints, environment reads, or API keys appear in frontend code.

The published Site remains owner-private. Hosting publication and its confirmed URL are recorded in the chat handoff. Browser checks used the existing narrow in-app viewport; a full device/accessibility matrix was not repeated. The backend still returns fixtures, stores no conversation data, and has no live provider/RAG/Risk Agent or manager delivery.

# Increment 3 verification

Checked on 10 October 2026:

- All 30 tests passed. Sixteen new tests use fake OpenAI upstream responses and cover strict request format, live action/message replies, demo isolation, missing keys, invalid selections, refusal, incomplete/malformed output, invented sources, unsupported confidence, high risk without escalation, sanitized provider/network errors, timeout, and Worker secret binding.
- TypeScript and the production React/Worker build passed. No provider SDK or new runtime dependency was added.
- The built Worker returns a clear JSON `503` for a live selection without its secret binding.
- Production frontend assets contain no provider API URL, server environment reads, backend secret variable names, or project-key pattern.
- The OpenAI Developers secure workflow created the approved key named Codex in the selected project, with a 30-day expiration, and saved it only to the approved local `.env`. Git confirms that `.env` is ignored. No key value was printed or included in a build/package.
- A live allergy request through the local backend returned a controlled `502`. A redacted direct request confirmed `UND_ERR_CONNECT_TIMEOUT`; an unauthenticated curl connectivity check also timed out. No OpenAI API response was received, so authentication, quota, model access, and an actual generated reply remain unverified.
- Browser checks confirmed the live GPT option, the company-knowledge limitation notice, loading state, and inline network error with retry. The failed live request did not produce a mock Action Card. The screenshot in the outputs folder records this result.
- Switching to Claude demo and sending a new opening-shift question produced an ordinary demo reply while the original live failure stayed available for retry.

The current source is increment 3. Hosted live activation remains pending: Sites accepts a plaintext secret value through its native setter, but available tools provide no secure handoff from the approved local env file. No key was transferred to hosting, and the published Site remains on increment 2. Publishing the new Worker should follow hosted secret setup. No frontend-key or plaintext-output workaround was used.

The live response schema and runtime evidence checks were tested against fake upstream responses; a real schema/model compatibility check remains outstanding because of the network timeout. Company retrieval, policy-version verification, a separate Risk Agent, and provider abstraction are still future work.

# Increment 4 verification

Checked on 10 October 2026:

- All 38 tests passed. Eight new tests verify the common provider interface with a fake provider, application-level response validation, plain text generation, generic structured parsing, safe parsing failures, unsupported provider selection, and the deferred streaming error. The existing OpenAI/API tests passed after moving transport code into its adapter.
- TypeScript and the production React/Worker build passed. No SDK, runtime dependency, agent framework, or frontend change was added.
- The built Worker returned a demo allergy Action Card with HTTP `200`, high risk, and escalation. A live selection without its backend secret returned the expected JSON `503`.
- Production frontend assets contain no provider endpoint, backend secret variable name, environment read, or project-key pattern.
- `server/chat.ts` uses only `AIProvider.structuredGenerate()`. The provider factory selects the OpenAI adapter; workplace instructions and evidence checks remain in the common chat module. A fake provider successfully produced both reply types through that module without an OpenAI request.
- `OpenAIProvider.generate()` and `structuredGenerate()` are implemented and tested with fake upstream responses. `stream()` deliberately returns a controlled unsupported error (`501`) without starting a network request. Streaming is deferred until the application needs it.
- An escalated, unauthenticated connectivity check still timed out before receiving an OpenAI response. No additional key was created, and no paid live request was made in this increment.
- Hosted environment inspection still reported no secret entries. The available secure local-key workflow has no supported handoff to the native Sites secret setter, so the approved local key was not printed or transferred through ordinary tool output.

The current source and starter ZIP are increment 4. Automatic approval review initially rejected uploading this increment to the private Sites repository because it would not accept the earlier approval retrieved from thread history. The user then explicitly approved uploading the verified source, excluding secrets, to the existing private project and saving a version without deployment. The checkpoint save result is recorded in the chat handoff.

The published Site remains on increment 2 while hosted secret setup is pending. Real OpenAI response verification remains outstanding because of the transport timeout. Other live provider adapters, company retrieval, policy-version checks, and the separate Risk Agent remain future increments. The unchanged frontend was not given another browser pass in this backend-only increment.

# Increment 5 verification

Checked on 10 October 2026:

- All 47 tests passed. Nine new parameterized tests cover Anthropic, DeepSeek, and Kimi using fake credentials and responses. They verify correct endpoint/key selection, both reply types, missing-key isolation, demo isolation, plain/structured generation, refusal, malformed or incomplete output, tool/ambiguous output rejection, sanitized transport failures, 15-second aborts, and Worker key bindings.
- All live routes use the common evidence checks. The tests reject invented citations, unsupported confidence, high risk without escalation, and nine-action responses. The shared runtime validator now enforces the output schema's eight-action limit.
- Claude schema transformation preserves keyword-like property names and the original schema. API-facing unsupported bounds are removed without changing the application's parser or evidence checks.
- The existing OpenAI tests passed after its HTTP/error handling moved into the same shared helper used by the other adapters. No provider SDK or runtime dependency was added.
- TypeScript and the production React/Worker build passed. The built Worker returned HTTP `200` Action Cards for all four demo selections and controlled JSON `503` responses for all four live selections without configured keys.
- Production frontend assets contain no provider endpoint, backend key variable name, server environment read, or project-key pattern. Git still excludes the real `.env`.
- Local browser checks showed all eight live/demo choices. Selecting live Claude and sending a question produced its missing-key error and retry button. Switching to live Kimi and sending another question produced the Kimi error while retaining the original Claude failure; no demo card or alternative-provider reply appeared.
- A local screenshot in the outputs folder records those provider-selection/error states. Browser verification used the narrow in-app viewport; the unchanged chat/card layout was not given a new full device or accessibility pass.
- Current provider request formats and selected model IDs were checked against official provider documentation. Fake-response tests verify our implementation, not actual account/model access or real API schema compatibility.

Increment 5 adds live adapter code and backend key bindings, not new credentials. No additional key was created, no plaintext secret was exposed, and no paid provider call was made in this increment. The prior OpenAI connectivity failure remains unresolved; Anthropic, DeepSeek, and Kimi keys are not configured. Real generated replies remain unverified.

This increment is saved as a private source checkpoint without deployment; the confirmed version is recorded in the chat handoff. The published Site remains on increment 2, and secure hosted secret setup remains pending. Streaming still returns a controlled `501` for all adapters. Company retrieval, policy-version verification, and the Knowledge/Risk/Main Agent workflow remain future increments.

# Final MVP: increments 6 and 7 verification

Checked on 10 October 2026:

- All **95 tests passed**: loopback HTTP, frontend clients, provider transports, Worker routing, retrieval/version checks, risk rules, final synthesis guards, and streaming. No runtime dependency or provider SDK was added.
- TypeScript and the production React/Worker build passed. Version `1.0.0` denotes this student MVP, not production safety certification.
- Seven retrieval tests cover latest effective approvals, retired/overdue versions without fallback to older approvals, future/draft revisions, invalid or ambiguous metadata, role filtering, sample/company modes, exact lexical matching, and the four-source limit.
- Seven risk tests cover allergy, emergency symptoms, operational hazards, payments/customer situations, missing/sample evidence, ordinary questions, and permission decisions with or without matching company evidence. Rules are a limited classifier, not a safety assessment certification.
- Sixteen Main Agent/API tests verify retrieved context, canonical citations, risk/confidence/escalation limits, application-owned verification/safety steps, ordinary versus action replies, permission and food-safety regressions, shared demo/live orchestration, and current role-filtered knowledge catalogs. Missing/sample ordinary replies use retrieved excerpts or clarification, not unconstrained model claims.
- Four knowledge-client tests cover valid catalogs, malformed records, failures without local fallbacks, and cancellation. The UI uses the same backend catalog as retrieval. Obsolete requests cannot update a page after a role change or unmount.
- Sixteen streaming tests cover all four native formats, split UTF-8/CRLF/multiline SSE, text versus reasoning, completion markers, refusal/tools/truncation, malformed frames, safe errors, deadlines through body reads, and early-stop cleanup. All use fake fetch. `POST /api/chat` returns completed JSON, not partial guidance.
- A built-Worker smoke check returned sourced high-risk demo cards with low confidence for all four demo providers, and JSON `503` for all four unconfigured live providers. The knowledge endpoint returned five current sample documents and excluded the retired revision.
- Frontend production assets contain no provider endpoint, backend key variable name, environment read, or project-key pattern. Git ignores the real `.env` and does not track it. Source/deployment packages exclude secret files.
- Browser checks loaded the current Knowledge Base and displayed policy effective/review dates and the v3 fictional Food Safety excerpt. A fresh allergy question rendered conservative actions, retrieved sample citations, low confidence, and manager escalation.
- Changing the role to Cashier preserved the original Waiter role/question in that card's manager draft. Saving placed it in Manager Dashboard marked Not sent. Selecting Claude demo and sending an opening checklist produced an ordinary sourced reply through the same API.
- A fresh permission question produced a manager-verification card despite matching an opening checklist. The responsive sidebar opened and New conversation closed it. The preview screenshot is stored beside the source ZIP. This was a functional/visual pass, not an exhaustive device/accessibility audit.

No key was created, plaintext secret exposed, or paid AI call made in this final increment. Real provider compatibility/account access, the OpenAI network timeout, other provider credentials, secure hosted-secret handoff, and a new deployment remain unverified or pending. The final private checkpoint's version/commit are reported in the handoff after saving succeeds.

All default policies are fictional. Replace them with approved company documents before workplace use; the application trusts maintained approval/version metadata rather than independently verifying approval. Conversations/drafts reset on reload, the role selector is context rather than authentication, and no manager notification is sent. README and ARCHITECTURE explain these limits and how to modify the code.

# FAQ and emergency-contact release 1.1.0

Checked on 11 October 2026:

- All **132 tests passed**, including 36 role-FAQ retrieval/isolation scenarios; real SQLite persistence, restart, review conflicts, role/expiry filtering; D1 adapter and Worker binding; input/client validation; and existing provider/risk regressions. No real provider call was made.
- TypeScript and production React/Worker builds pass. One generated table migration is packaged for hosted D1. Local `.data` records and `.env` are ignored and excluded from deployment.
- Browser checks confirmed 12 distinct questions per role, cashier receipt search, source-backed answers, and Ask this question prefilling a fresh chat.
- A local Kitchen Staff question was submitted, reviewed with an answer and reference, published, shown in the Knowledge Base, found after a page reload, and cited by a subsequent demo chat. Local test content is not shipped to hosted storage.
- Browser QA found and fixed local Vite proxy origin rewriting. Explicit `changeOrigin: false` and the Node adapter's validated loopback Host preserve the browser origin. A regression test covers accepted local origins, rejected cross-origins, and rejected non-loopback hosts.
- A 390px-wide browser check showed the FAQ search, category control, and cards wrapping without horizontal overflow; desktop source/FAQ screens were also inspected. This was not an exhaustive device or accessibility audit.
- The high-risk manager panel displays the supplied fake contact details, disabled call/link controls, and an immediate-danger reminder. No call or external contact was attempted.
- Reviewed answers stay sample evidence. Source references are manager-entered and unverified. Review is an owner-private demonstration, not authenticated employee/manager access control.
- Dependencies added for migration generation reported four moderate development-tool advisories during installation. No forced major-version dependency changes were applied; no Drizzle code is imported by the deployed Worker.

Production end-to-end UI verification is separate from local checks and the native deployment receipt. Earlier automated requests to the private production site were blocked at its edge, while the owner verified version 6. Real model responses, real company policies, and actual manager delivery are outside this demo's verified behavior.
