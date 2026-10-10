import type { ChatRequest, ChatResponse, Source } from "./chat";
import { models, roles } from "./catalog";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_BODY_BYTES = 32 * 1024;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChatRequest(value: unknown): ChatRequest {
  if (!isRecord(value))
    throw new Error("Send a JSON object with the chat fields.");
  if (typeof value.message !== "string" || !value.message.trim())
    throw new Error("Please enter a message.");
  if (value.message.length > MAX_MESSAGE_LENGTH)
    throw new Error("Keep your message under 4,000 characters.");

  const role = roles.find((item) => item.id === value.employee_role);
  if (!role) throw new Error("Choose a supported employee role.");
  const model = models.find(
    (item) => item.provider === value.provider && item.model === value.model,
  );
  if (!model) throw new Error("Choose a supported provider and model pair.");
  // Reconstruct known fields; do not forward arbitrary client properties.
  return {
    message: value.message.trim(),
    employee_role: role.id,
    provider: model.provider,
    model: model.model,
  };
}

export function isSource(value: unknown): value is Source {
  return (
    isRecord(value) &&
    (value.sample === undefined || typeof value.sample === "boolean") &&
    ["id", "title", "version", "section", "excerpt"].every(
      (key) => typeof value[key] === "string" && value[key].trim().length > 0,
    )
  );
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.sources) ||
    !value.sources.every(isSource)
  )
    return false;
  if (value.type === "message")
    return typeof value.content === "string" && !!value.content.trim();
  return (
    value.type === "action" &&
    typeof value.risk === "string" &&
    ["low", "medium", "high"].includes(value.risk) &&
    typeof value.summary === "string" &&
    !!value.summary.trim() &&
    Array.isArray(value.actions) &&
    value.actions.length > 0 &&
    value.actions.length <= 8 &&
    value.actions.every(
      (action) => typeof action === "string" && !!action.trim(),
    ) &&
    typeof value.confidence === "string" &&
    ["low", "medium", "high"].includes(value.confidence) &&
    typeof value.escalate === "boolean"
  );
}

export function parseChatResponse(value: unknown): ChatResponse {
  if (!isChatResponse(value))
    throw new Error(
      "The server returned an invalid chat response. Please retry.",
    );
  return value;
}
