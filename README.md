# Frontline Workplace Knowledge Agent

This is **increment 5: four provider adapters behind one chat API**. React calls `POST /api/chat`; the backend selects OpenAI, Anthropic, DeepSeek, or Kimi through `AIProvider` and returns the same message/Action Card format. Each has a clearly labeled live choice and a demo choice. Live adapters are implemented, but real provider responses remain unverified: OpenAI connectivity previously timed out, and the other provider keys have not been configured. Hosted live activation is also pending.

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
- Choose any **live** model for its backend provider path. It needs that provider's server-side key and outbound network access. Errors stay visible; the app never substitutes a demo answer or a different provider for a failed live request.
- Live Action Cards have low confidence and no company sources until retrieval is connected. **View Source** is disabled when sources are unavailable.
- Open a source to read its fictional excerpt.
- Use **Ask Manager** to edit/copy an escalation note or save a session draft to Manager Dashboard. Nothing is sent.
- If a request fails, **Retry request** resends the original role, model, and question without duplicating the worker message. Each chat keeps its own loading/error state.
- Conversations and drafts stay in React memory. Reloading resets them. The backend stores nothing, and only the current question is sent; visible history is not model memory.

Demo keyword matching demonstrates rendering. Every live provider uses the same conservative workplace prompt and runtime checks, but neither path verifies food safety or current company policy versions. “High confidence” on sample cards describes the fictional procedure, never whether a food is safe. A dedicated Knowledge Agent and Risk Agent are not implemented yet.

## Read the code in this order

1. `shared/chat.ts`: common request/response types.
2. `src/services/chatClient.ts`: the frontend’s only chat transport, using `fetch('/api/chat')`.
3. `server/api.ts`: validates HTTP input and returns the standard response or a JSON error.
4. `shared/catalog.ts`: approved provider/model selections and their live/demo mode.
5. `server/providers/AIProvider.ts`: common input/output types, three methods, and safe provider errors.
6. `server/chat.ts`: workplace prompt and evidence checks, using only the common interface.
7. `server/providers/OpenAIProvider.ts`, `AnthropicProvider.ts`, `DeepSeekProvider.ts`, and `KimiProvider.ts`: translate the common interface into each provider's API.
8. `server/providers/registry.ts`: selects an implemented adapter from the requested provider.
9. `server/providers/request.ts`: shared backend HTTP, timeout, safe errors, and JSON parsing. `chatCompletion.ts` contains the small format helpers shared by DeepSeek and Kimi.
10. `server/responseSchema.ts`: message/action schema, nested in a root object and unwrapped on the backend.
11. `server/mockChat.ts`: demo behavior, kept separate from the live path.
12. `shared/validation.ts`: checks incoming JSON at runtime, on both sides.
13. `src/components/ActionCard.tsx`: renders an action response without knowing its provider.
14. `server/nodeServer.ts` and `server/worker.ts`: small local/hosted adapters.
15. `src/App.tsx`: coordinates conversations, role, model, and dialogs.

There is no application router, database, state-management library, agent framework, or provider SDK. Node’s native HTTP server is sufficient here. `tsx` runs the TypeScript backend and Node’s built-in test runner. Read `docs/ARCHITECTURE.md` for the current flow and the remaining increments.

## Provider interface

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

`ProviderInput` contains the model, system prompt, user prompt, and optional output-token limit. `OutputSchema` contains a name, JSON schema, and runtime parser. None contains SDK types or keys. The chat module uses `structuredGenerate()`; its evidence safeguards also check the parsed result, so they apply to every provider. The parser is responsible for validating application fields; this project does not include a general JSON Schema validator.

All four adapters implement plain `generate()` and validated `structuredGenerate()`. `stream()` is reserved in the interface but currently throws a controlled `501`; backend streaming and UI streaming remain deferred until the complete live flow is verified. The API never renders an unfinished Action Card.

The factory has one explicit case per provider. Selecting Claude now routes to `AnthropicProvider`, selecting DeepSeek to `DeepSeekProvider`, and selecting Kimi to `KimiProvider`. Demo choices bypass these adapters and return fixtures without a key. No provider plugin system or automatic fallback is needed.

| Provider  | Live model ID               | Backend variable    | Output strategy                                          |
| --------- | --------------------------- | ------------------- | -------------------------------------------------------- |
| OpenAI    | `gpt-4.1-mini`              | `OPENAI_API_KEY`    | Native JSON schema                                       |
| Anthropic | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` | Native JSON schema, adapted to Claude's supported subset |
| DeepSeek  | `deepseek-flash`            | `DEEPSEEK_API_KEY`  | JSON-object mode, schema in prompt, runtime parsing      |
| Kimi      | `kimi-k2.6`                 | `KIMI_API_KEY`      | JSON-object mode, schema in prompt, runtime parsing      |

Claude's adapter removes unsupported schema bounds such as `maxItems` only from the schema it sends; common runtime guards still enforce at most eight actions and no unverified sources. [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) explains the supported schema subset. The fixed [Haiku 4.5 model](https://platform.claude.com/docs/en/models/haiku-4-5/overview) supports this format without enabling thinking.

[DeepSeek JSON mode](https://api-docs.deepseek.com/guides/json_mode/) ensures JSON syntax, not our full application contract. [Kimi JSON mode](https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api) uses the same approach here. Both adapters explicitly disable thinking and accept only a completed answer, never reasoning text or tool calls. Their native request differences stay inside their adapters. The backend validates every result and reports malformed or truncated replies as errors.

## API

```sh
curl http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Customer has a peanut allergy","employee_role":"waiter","provider":"openai","model":"demo-gpt"}'
```

Accepted demo and live pairs are in `shared/catalog.ts`. Use `"model":"gpt-4.1-mini"` with `"provider":"openai"` for the live path. Invalid fields return `400`, oversized bodies `413`, non-JSON content `415`, wrong methods `405`, and unknown routes `404`. Live errors use `503` for missing/authentication configuration, `429` for API usage limits, `422` for refusal, `504` for timeout, and `502` for unusable output or network failure. Errors use `{ "error": "message" }`; successful replies keep the common contract.

## API keys and hosting

Only the backend reads API keys. The local Node server loads `.env`; `.env.example` contains empty variable names. `.env` and `.env.*` are ignored except `.env.example`. Configure only the providers you intend to use. Demo selections need no keys. Never put keys in React, frontend settings, the catalog, hosting metadata, or `VITE_` variables.

The Kimi adapter targets `api.moonshot.ai`, so `KIMI_API_KEY` must be issued by the global Kimi/Moonshot platform. Obtain other provider keys through their own secure consoles and save them in the ignored backend `.env`; this increment does not create those accounts or keys. A missing selected-provider key returns `503` before making a provider request.

OpenAI Developers securely created a project key and saved it to the approved local `.env`, with a 30-day expiration. No key value appears in this source or downloadable package. Replace the key before its expiration when continuing development; the application does not rotate keys automatically.

The existing private Sites deployment uses a Cloudflare Worker plus the React static assets. Its access audience is preserved. `scripts/prepare-hosting.mjs` writes non-secret build configuration; `server/worker.ts` delegates assets through the [Cloudflare assets binding](https://developers.cloudflare.com/workers/static-assets/binding/). The Worker receives configured provider keys as hosted runtime secrets; local `.env` is never deployed. Current tooling has no secure file-to-Sites-secret handoff, so the hosted site remains on increment 2 pending that setup. The local source/build contains increment 5; source versions can be saved without deployment.

The OpenAI call uses [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) supports this format. The schema helps enforce shape; runtime validation also rejects invented citations, unsupported confidence, and high risk without escalation. These checks are not a complete safety evaluator.

The role selector is context, not authentication or permission to act as a manager. Company-specific access and real manager delivery remain future work. See `docs/VERIFICATION.md` for completed checks and limitations.
