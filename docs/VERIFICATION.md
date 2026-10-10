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
