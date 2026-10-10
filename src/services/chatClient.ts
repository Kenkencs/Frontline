import type { ChatRequest, ChatResponse } from "../../shared/chat";
import { getMockResponse } from "./mockChat";

// Every component calls this function. No component knows which transport or provider is used.
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  if (!request.message.trim()) throw new Error("Please enter a message.");
  if (request.message.length > 4000)
    throw new Error("Keep your message under 4,000 characters.");
  await new Promise((resolve) => setTimeout(resolve, 650));
  return getMockResponse(request);
}

// Stage 2 replaces the body above with fetch('/api/chat', ...). See docs/ARCHITECTURE.md.
