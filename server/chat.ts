import type { ChatRequest, ChatResponse } from "../shared/chat";
import type { AIProvider } from "./providers/AIProvider";
import { runMainAgent, type MainAgentOptions } from "./agents/mainAgent";

// A small entry point for existing callers; the Main Agent owns coordination.
export function generateChat(
  input: ChatRequest,
  provider: AIProvider,
  context: Pick<MainAgentOptions, "documents" | "now"> = {},
): Promise<ChatResponse> {
  return runMainAgent(input, { ...context, mode: "live", provider });
}
