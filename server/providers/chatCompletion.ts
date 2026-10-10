import { isRecord } from "../../shared/validation";
import {
  ProviderError,
  type OutputSchema,
  type ProviderInput,
} from "./AIProvider";
import { eventJson, invalidResponse, refusedResponse } from "./request";
import type { ServerEvent } from "./sse";

// JSON mode ensures JSON syntax; the schema parser still checks its application shape.
export function jsonSystemPrompt(
  input: ProviderInput,
  schema?: OutputSchema<unknown>,
): string {
  return schema
    ? `${input.systemPrompt}\nReturn only a JSON object matching this JSON schema:\n${JSON.stringify(schema.jsonSchema)}`
    : input.systemPrompt;
}

// DeepSeek and Kimi use the same non-streamed Chat Completions envelope.
export function readChatCompletion(value: unknown): string {
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    value.choices.length !== 1
  )
    throw invalidResponse();
  const choice: unknown = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) throw invalidResponse();
  const message = choice.message;
  if (choice.finish_reason === "content_filter" || message.refusal)
    throw new ProviderError(
      422,
      "The live model could not help with this request. Rephrase it or ask your manager.",
    );
  if (choice.finish_reason !== "stop")
    throw new ProviderError(
      502,
      "The live model returned an incomplete response. Please retry.",
    );
  if (
    message.role !== "assistant" ||
    (message.tool_calls !== undefined &&
      (!Array.isArray(message.tool_calls) || message.tool_calls.length > 0)) ||
    typeof message.content !== "string" ||
    !message.content.trim()
  )
    throw invalidResponse();
  // Never render reasoning_content, tool arguments, or another candidate's content.
  return message.content;
}

// Both APIs use text deltas followed by finish_reason: stop and data: [DONE].
// A disconnected stream without both markers must not appear successful.
export async function* streamChatCompletion(
  events: AsyncIterable<ServerEvent>,
): AsyncIterable<string> {
  let finished = false;
  let textSeen = false;
  for await (const event of events) {
    if (event.data === "[DONE]") {
      if (!finished || !textSeen) throw invalidResponse();
      return;
    }
    const value = eventJson(event);
    if (isRecord(value.error)) {
      if (value.error.type === "content_filter") throw refusedResponse();
      throw invalidResponse();
    }
    if (
      value.object !== "chat.completion.chunk" ||
      !Array.isArray(value.choices)
    )
      throw invalidResponse();
    // Optional usage-only chunks have no content to display.
    if (!value.choices.length && isRecord(value.usage)) continue;
    if (finished || value.choices.length !== 1) throw invalidResponse();
    const choice: unknown = value.choices[0];
    if (!isRecord(choice) || choice.index !== 0 || !isRecord(choice.delta))
      throw invalidResponse();
    const delta = choice.delta;
    if (choice.finish_reason === "content_filter" || delta.refusal)
      throw refusedResponse();
    if (
      (delta.tool_calls != null &&
        (!Array.isArray(delta.tool_calls) || delta.tool_calls.length)) ||
      delta.function_call != null ||
      (delta.role != null && delta.role !== "assistant")
    )
      throw invalidResponse();
    if (choice.finish_reason != null && choice.finish_reason !== "stop")
      throw invalidResponse();
    if (delta.content != null) {
      if (typeof delta.content !== "string") throw invalidResponse();
      textSeen ||= !!delta.content.trim();
      if (delta.content) yield delta.content;
    }
    if (choice.finish_reason === "stop") finished = true;
  }
  throw invalidResponse();
}
