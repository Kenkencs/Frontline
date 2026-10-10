# Frontline Workplace Knowledge Agent

This is **increment 3: React → backend API → one OpenAI integration → Action Card**. The code now supports a live GPT-4.1 mini selection through the same `POST /api/chat` endpoint. Four clearly labeled demo selections still use fixtures. The live integration is ready for verification, but the current machine cannot reach OpenAI and hosted live activation is pending. Retrieval and specialist agents remain later increments.

## Run it

Use Node.js 22.12+ or a current supported LTS release.

```sh
npm install
npm run dev
```

One command starts Vite and the Node backend. Open Vite’s printed local URL (normally `http://127.0.0.1:5173`). Vite proxies `/api` to the loopback backend on port 3001. Stop both with Ctrl+C. If you prefer separate terminals, use `npm run dev:server` and `npm run dev:frontend`.

```sh
npm test
npm run build
npm run preview
```

The preview command also starts both processes; open its printed URL (normally port 4173). The build produces `dist/client` for React and `dist/server/index.js` for the hosted Worker. The Worker and local Node server use the same API handler.

## Try it

- Start a new conversation and send “A customer has a food allergy” for a high-risk Action Card.
- Send “Opening shift checklist” for an ordinary message or “Handling a customer complaint” for a medium-risk card.
- Choose GPT, Claude, DeepSeek, or Kimi **demo** to receive backend fixtures without an API key or provider charge.
- Choose **GPT-4.1 mini (live)** for the backend OpenAI path. It requires a server-side key and outbound access to OpenAI. Errors stay visible; the app never substitutes a demo answer for a failed live request.
- Live Action Cards have low confidence and no company sources until retrieval is connected. **View Source** is disabled when sources are unavailable.
- Open a source to read its fictional excerpt.
- Use **Ask Manager** to edit/copy an escalation note or save a session draft to Manager Dashboard. Nothing is sent.
- If a request fails, **Retry request** resends the original role, model, and question without duplicating the worker message. Each chat keeps its own loading/error state.
- Conversations and drafts stay in React memory. Reloading resets them. The backend stores nothing, and only the current question is sent; visible history is not model memory.

Demo keyword matching demonstrates rendering. Live GPT uses a conservative prompt and strict JSON output, but neither path verifies food safety or current company policy versions. “High confidence” on sample cards describes the fictional procedure, never whether a food is safe. A dedicated Knowledge Agent and Risk Agent are not implemented yet.

## Read the code in this order

1. `shared/chat.ts`: common request/response types.
2. `src/services/chatClient.ts`: the frontend’s only chat transport, using `fetch('/api/chat')`.
3. `server/api.ts`: validates HTTP input and returns the standard response or a JSON error.
4. `shared/catalog.ts`: approved provider/model selections and their live/demo mode.
5. `server/openaiChat.ts`: one OpenAI Responses request, error handling, and evidence checks.
6. `server/responseSchema.ts`: strict message/action schema, nested in a root object and unwrapped on the backend.
7. `server/mockChat.ts`: demo behavior, kept separate from the live path.
8. `shared/validation.ts`: checks incoming JSON at runtime, on both sides.
9. `src/components/ActionCard.tsx`: renders an action response without knowing its provider.
10. `server/nodeServer.ts` and `server/worker.ts`: small local/hosted adapters.
11. `src/App.tsx`: coordinates conversations, role, model, and dialogs.

There is no application router, database, state-management library, agent framework, or provider SDK. Node’s native HTTP server is sufficient here. `tsx` runs the TypeScript backend and Node’s built-in test runner. Read `docs/ARCHITECTURE.md` for the current flow and the remaining increments.

## API

```sh
curl http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Customer has a peanut allergy","employee_role":"waiter","provider":"openai","model":"demo-gpt"}'
```

Accepted demo and live pairs are in `shared/catalog.ts`. Use `"model":"gpt-4.1-mini"` with `"provider":"openai"` for the live path. Invalid fields return `400`, oversized bodies `413`, non-JSON content `415`, wrong methods `405`, and unknown routes `404`. Live errors use `503` for missing/authentication configuration, `429` for API usage limits, `422` for refusal, `504` for timeout, and `502` for unusable output or network failure. Errors use `{ "error": "message" }`; successful replies keep the common contract.

## API keys and hosting

Live GPT reads `OPENAI_API_KEY` only on the backend. The local Node server loads `.env`; `.env.example` contains empty variable names. `.env` and `.env.*` are ignored except `.env.example`. Demo selections need no keys. The other provider variables are reserved for increment 5. Never put keys in React, frontend settings, the catalog, hosting metadata, or `VITE_` variables.

OpenAI Developers securely created a project key and saved it to the approved local `.env`, with a 30-day expiration. No key value appears in this source or downloadable package. Replace the key before its expiration when continuing development; the application does not rotate keys automatically.

The existing private Sites deployment uses a Cloudflare Worker plus the React static assets. Its access audience is preserved. `scripts/prepare-hosting.mjs` writes non-secret build configuration; `server/worker.ts` delegates assets through the [Cloudflare assets binding](https://developers.cloudflare.com/workers/static-assets/binding/). The Worker expects `OPENAI_API_KEY` as a hosted runtime secret; local `.env` is never deployed. Current tooling has no secure file-to-Sites-secret handoff, so the hosted site remains on increment 2 pending that setup. The local source/build contains increment 3.

The OpenAI call uses [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) supports this format. The schema helps enforce shape; runtime validation also rejects invented citations, unsupported confidence, and high risk without escalation. These checks are not a complete safety evaluator.

The role selector is context, not authentication or permission to act as a manager. Company-specific access and real manager delivery remain future work. See `docs/VERIFICATION.md` for completed checks and limitations.
