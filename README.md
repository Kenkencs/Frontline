# Frontline Workplace Knowledge Agent

This is **increment 1: React frontend → mock response → Action Card**. It runs without API keys. There is no backend, live AI, retrieval, or real risk evaluation yet.

## Run it

Use Node.js 22.12+ or a current supported LTS release.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To check and build:

```sh
npm run build
```

## Try the first increment

- The initial conversation shows the peanut allergy Action Card.
- Start a new conversation and send “Opening shift checklist” for an ordinary message.
- Send “A customer has a food allergy” for a high-risk Action Card.
- Send “Handling a customer complaint” for a medium-risk Action Card.
- Choose GPT, Claude, DeepSeek, or Kimi. All selections are explicitly demos and call the same mock service.
- Open a source to read the actual sample excerpt.
- Use **Ask Manager** to edit and copy an escalation note, or save a draft to the simple Manager Dashboard. Nothing is sent.
- Conversations and drafts are held in memory for this session. Reloading resets them. No server or browser-storage persistence is implemented.

The mock uses a few keyword checks to demonstrate rendering. It does not assess real operational risk, answer follow-up context, verify the safety of food, or check real policy versions. “High confidence” refers to the sample procedure, never to whether a food is safe. All SOPs are fictional excerpts.

## Read the code in this order

1. `shared/chat.ts`: the request and standard response contract.
2. `src/services/chatClient.ts`: the single entry point for chat requests.
3. `src/services/mockChat.ts`: the fixture responses used in this increment.
4. `src/components/ActionCard.tsx`: turns a structured response into a card.
5. `src/App.tsx`: coordinates conversations, navigation, role, model, and dialogs.
6. `src/styles.css`: plain CSS for the light desktop/mobile layout.

There is no router, state-management framework, database, agent framework, or provider SDK. React state and a few small components are enough here. Vite supplies the development server and production build; see [Vite’s guide](https://vite.dev/guide/). Typed React component props follow [React’s TypeScript guide](https://react.dev/learn/typescript).

## Next step

Read `docs/ARCHITECTURE.md` before adding the backend. The next increment will add one `POST /api/chat` endpoint returning the same mock responses, then replace the body of `sendChat()` with a request to that endpoint. The UI remains the same.

## API keys

`.env.example` lists the future backend variables. Do not enter real keys in React code, the model catalog, frontend settings, or variables prefixed with `VITE_`. `.env` and `.env.*` are ignored; `.env.example` is the only exception. Stage 1 does not read any environment variables.

The prototype supports local development and private static hosting with Sites. Its hosting configuration is optional for local development. Do not assume it can execute the future backend; we will explain and choose backend hosting when building increment 2. The confirmed deployment link is provided in the chat handoff.

## Verification

The handoff includes TypeScript checking, a production build, and browser checks of normal/action replies, model switching, source dialogs, escalation drafts, and mobile navigation. See `docs/VERIFICATION.md` for the checks actually completed.
