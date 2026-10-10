import type { ChatResponse, ChatRequest } from "../shared/chat";

export type View = "chat" | "knowledge" | "manager" | "settings";
export type ChatMessage =
  | { id: string; author: "worker"; text: string }
  | {
      id: string;
      author: "assistant";
      response: ChatResponse;
      modelLabel: string;
      request: ChatRequest;
    };

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface EscalationDraft {
  id: string;
  text: string;
}
