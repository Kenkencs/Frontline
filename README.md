# Frontline Workplace Knowledge Agent

This is **increment 2: React → backend API → mock response → Action Card**. A real `POST /api/chat` endpoint now runs locally and on the private hosted site. Responses still use fictional fixtures; live AI, retrieval, and risk evaluation come in later increments.

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
- Choose GPT, Claude, DeepSeek, or Kimi. All selections are labeled demos and reach the same backend mock service.
- Open a source to read its fictional excerpt.
- Use **Ask Manager** to edit/copy an escalation note or save a session draft to Manager Dashboard. Nothing is sent.
- If a request fails, **Retry request** resends the original role, model, and question without duplicating the worker message. Each chat keeps its own loading/error state.
- Conversations and drafts stay in React memory. Reloading resets them. The backend stores nothing, and only the current question is sent; visible history is not model memory.

Keyword matching demonstrates rendering. It does not assess real operational risk, interpret follow-up context, verify food safety, or check company policy versions. “High confidence” describes the sample procedure, never whether a food is safe. All SOPs are fictional.

## Read the code in this order

1. `shared/chat.ts`: common request/response types.
2. `src/services/chatClient.ts`: the frontend’s only chat transport, using `fetch('/api/chat')`.
3. `server/api.ts`: validates HTTP input and returns the standard response or a JSON error.
4. `server/mockChat.ts`: demo behavior; replace this call with one live provider in increment 3.
5. `shared/validation.ts`: checks incoming JSON at runtime, on both sides.
6. `src/components/ActionCard.tsx`: renders an action response without knowing its provider.
7. `server/nodeServer.ts` and `server/worker.ts`: small adapters for local development and private hosting.
8. `src/App.tsx`: coordinates conversations, role, model, and dialogs.

There is no application router, database, state-management library, agent framework, or provider SDK. Node’s native HTTP server is sufficient here. `tsx` runs the TypeScript backend and Node’s built-in test runner. Read `docs/ARCHITECTURE.md` for the current flow and the remaining increments.

## API

```sh
curl http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Customer has a peanut allergy","employee_role":"waiter","provider":"openai","model":"demo-gpt"}'
```

Accepted demo pairs are in `shared/catalog.ts`. Invalid fields return `400`, oversized bodies `413`, non-JSON content `415`, wrong methods `405`, and unknown API routes `404`. Errors use `{ "error": "message" }`; successful replies keep the common message/action contract. There is no local mock fallback if the API fails.

## API keys and hosting

No keys are needed or read in increment 2. `.env.example` reserves the future backend variable names. `.env` and `.env.*` are ignored except `.env.example`. Never put keys in React, frontend settings, the catalog, hosting metadata, or `VITE_` variables.

The existing private Sites deployment now uses a Cloudflare Worker for `/api/chat` plus the React static assets. Its access audience is preserved. `scripts/prepare-hosting.mjs` writes non-secret build configuration; `server/worker.ts` delegates assets through the [Cloudflare assets binding](https://developers.cloudflare.com/workers/static-assets/binding/). Hosted secrets will be configured through the hosting platform, not committed environment files.

The role selector is context, not authentication or permission to act as a manager. Company-specific access and real manager delivery remain future work. See `docs/VERIFICATION.md` for completed checks and limitations.
