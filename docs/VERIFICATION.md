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
