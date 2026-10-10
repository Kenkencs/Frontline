import type { ChatRequest, ChatResponse } from "../../shared/chat";
import {
  isRecord,
  parseChatRequest,
  parseChatResponse,
} from "../../shared/validation";

const TIMEOUT_MS = 20_000;

// Components know only this contract, never a provider SDK or an API key.
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const input = parseChatRequest(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error("The server did not return JSON. Please retry.");
    }
    if (!response.ok) {
      throw new Error(
        isRecord(value) && typeof value.error === "string"
          ? value.error
          : "Could not get a response. Please retry.",
      );
    }
    return parseChatResponse(value);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("The request timed out. Please retry.");
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the backend. Please retry when it is available.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
