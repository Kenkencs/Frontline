import { isRecord } from "../../shared/validation";
import {
  ProviderError,
  type OutputSchema,
  type ProviderInput,
} from "./AIProvider";
import { invalidResponse } from "./request";

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
