import { handleApiRequest } from "./api";

interface WorkerEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  KIMI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/"))
      return handleApiRequest(request, {
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
