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

There are no tests or checks of live AI, backend endpoints, RAG, current company policy versions, real risk evaluation, or manager delivery: those capabilities are deliberately deferred.

On 9 October, private Sites publication was blocked by automatic approval review because the external source upload had not been explicitly authorized. On 10 October, the user approved that upload and private publication. The confirmed deployment result and live link are provided in the chat handoff.
