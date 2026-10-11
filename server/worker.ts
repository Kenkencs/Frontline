import { handleApiRequest } from "./api";
import { createD1FaqStore, type FaqD1Database } from "./faq/store";

interface WorkerEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  KIMI_API_KEY?: string;
  DB?: FaqD1Database;
}

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/"))
      return handleApiRequest(request, {
        faqStore: env.DB ? createD1FaqStore(env.DB) : undefined,
        apiKeys: {
          openai: env.OPENAI_API_KEY,
          anthropic: env.ANTHROPIC_API_KEY,
          deepseek: env.DEEPSEEK_API_KEY,
          kimi: env.KIMI_API_KEY,
        },
      });
    return env.ASSETS.fetch(request);
  },
};
