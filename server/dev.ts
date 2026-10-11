import { createApiServer } from "./nodeServer";
import { openLocalFaqStore } from "./localDatabase";

// Node loads local secrets on the server only; .env is ignored by Git.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}

// Loopback only. Vite proxies /api here, so the browser uses one origin.
const server = createApiServer({
  faqStore: openLocalFaqStore(),
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    kimi: process.env.KIMI_API_KEY,
  },
});
server.listen(3001, "127.0.0.1", () =>
  console.log("Backend: http://127.0.0.1:3001/api/chat"),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
