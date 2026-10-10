import { handleApiRequest } from "./api";

interface WorkerEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/"))
      return handleApiRequest(request, { openaiApiKey: env.OPENAI_API_KEY });
    return env.ASSETS.fetch(request);
  },
};
