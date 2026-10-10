import { isRecord } from "../../shared/validation";
import {
  ProviderError,
  type AIProvider,
  type OutputSchema,
  type ProviderInput,
} from "./AIProvider";
import {
  invalidResponse,
  parseStructured,
  requestJson,
  requestStream,
  eventJson,
  refusedResponse,
} from "./request";

// Claude supports a smaller schema subset. Keep the original parser and guards
// authoritative; adapt only the schema sent to its API, without mutating it.
function claudeSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...schema };
  for (const keyword of [
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "maxItems",
    "uniqueItems",
    "contains",
    "minContains",
    "maxContains",
  ])
    delete result[keyword];
  if ("minItems" in result && result.minItems !== 0 && result.minItems !== 1)
    delete result.minItems;

  // These are maps of property names, not schema nodes. A field named
  // "maxItems" or "minimum" must survive the transformation.
  for (const keyword of ["properties", "$defs", "definitions"])
    if (isRecord(result[keyword]))
      result[keyword] = Object.fromEntries(
        Object.entries(result[keyword]).map(([name, value]) => [
          name,
          isRecord(value) ? claudeSchema(value) : value,
        ]),
      );
  if (isRecord(result.items)) result.items = claudeSchema(result.items);
  for (const keyword of ["anyOf", "allOf", "oneOf"])
    if (Array.isArray(result[keyword]))
      result[keyword] = result[keyword].map((value: unknown) =>
        isRecord(value) ? claudeSchema(value) : value,
      );
  return result;
}

export class AnthropicProvider implements AIProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  generate(input: ProviderInput): Promise<string> {
    return this.request(input);
  }

  async structuredGenerate<T>(
    input: ProviderInput,
    schema: OutputSchema<T>,
  ): Promise<T> {
    return parseStructured(await this.request(input, schema), schema);
  }

  async *stream(input: ProviderInput): AsyncIterable<string> {
    let started = false;
    let textSeen = false;
    let stopReason: string | undefined;
    const blocks = new Map<number, string>();
    const events = requestStream(
      {
        providerName: "Anthropic",
        apiKey: this.apiKey,
        url: "https://api.anthropic.com/v1/messages",
        keyHeader: "x-api-key",
        headers: { "anthropic-version": "2023-06-01" },
        body: {
          model: input.model,
          system: input.systemPrompt,
          messages: [{ role: "user", content: input.prompt }],
          max_tokens: input.maxOutputTokens ?? 1200,
          stream: true,
        },
      },
      this.fetchImpl,
    );
    for await (const event of events) {
      const value = eventJson(event);
      if (typeof value.type !== "string") throw invalidResponse();
      if (value.type === "error") throw invalidResponse();
      if (value.type === "message_start") {
        if (
          started ||
          !isRecord(value.message) ||
          value.message.role !== "assistant"
        )
          throw invalidResponse();
        started = true;
      }
      if (value.type === "content_block_start") {
        if (
          !started ||
          !Number.isInteger(value.index) ||
          !isRecord(value.content_block) ||
          blocks.has(value.index as number)
        )
          throw invalidResponse();
        const type = value.content_block.type;
        if (
          typeof type !== "string" ||
          !["text", "thinking", "redacted_thinking"].includes(type)
        )
          throw invalidResponse();
        blocks.set(value.index as number, type);
        if (type === "text" && value.content_block.text) {
          if (typeof value.content_block.text !== "string")
            throw invalidResponse();
          textSeen ||= !!value.content_block.text.trim();
          yield value.content_block.text;
        }
      }
      if (value.type === "content_block_delta") {
        if (
          !started ||
          !Number.isInteger(value.index) ||
          !isRecord(value.delta)
        )
          throw invalidResponse();
        const block = blocks.get(value.index as number);
        if (!block) throw invalidResponse();
        if (value.delta.type === "text_delta") {
          if (block !== "text" || typeof value.delta.text !== "string")
            throw invalidResponse();
          textSeen ||= !!value.delta.text.trim();
          if (value.delta.text) yield value.delta.text;
        } else if (
          !["thinking_delta", "signature_delta"].includes(
            value.delta.type as string,
          ) ||
          !["thinking", "redacted_thinking"].includes(block)
        )
          throw invalidResponse();
      }
      if (value.type === "content_block_stop") {
        if (!blocks.delete(value.index as number)) throw invalidResponse();
      }
      if (value.type === "message_delta") {
        if (!started || !isRecord(value.delta)) throw invalidResponse();
        if (value.delta.stop_reason === "refusal") throw refusedResponse();
        if (value.delta.stop_reason != null) {
          if (value.delta.stop_reason !== "end_turn") throw invalidResponse();
          stopReason = value.delta.stop_reason;
        }
      }
      if (value.type === "message_stop") {
        if (!started || stopReason !== "end_turn" || blocks.size || !textSeen)
          throw invalidResponse();
        return;
      }
    }
    throw invalidResponse();
  }

  private async request(
    input: ProviderInput,
    schema?: OutputSchema<unknown>,
  ): Promise<string> {
    const value = await requestJson(
      {
        providerName: "Anthropic",
        apiKey: this.apiKey,
        url: "https://api.anthropic.com/v1/messages",
        keyHeader: "x-api-key",
        headers: { "anthropic-version": "2023-06-01" },
        body: {
          model: input.model,
          system: input.systemPrompt,
          messages: [{ role: "user", content: input.prompt }],
          max_tokens: input.maxOutputTokens ?? 1200,
          stream: false,
          ...(schema
            ? {
                output_config: {
                  format: {
                    type: "json_schema",
                    schema: claudeSchema(schema.jsonSchema),
                  },
                },
              }
            : {}),
        },
      },
      this.fetchImpl,
    );
    if (!isRecord(value)) throw invalidResponse();
    if (value.stop_reason === "refusal")
      throw new ProviderError(
        422,
        "The live model could not help with this request. Rephrase it or ask your manager.",
      );
    if (
      value.type !== "message" ||
      value.role !== "assistant" ||
      value.stop_reason !== "end_turn" ||
      !Array.isArray(value.content)
    )
      throw invalidResponse();

    // Thinking is separate from the answer. Tools and unfinished turns are not
    // supported here, so never turn those blocks into a completed Action Card.
    if (
      value.content.some(
        (block: unknown) =>
          !isRecord(block) ||
          !["text", "thinking", "redacted_thinking"].includes(
            block.type as string,
          ),
      )
    )
      throw invalidResponse();
    const texts = value.content.filter(
      (block: unknown) => isRecord(block) && block.type === "text",
    );
    if (
      texts.length !== 1 ||
      typeof texts[0].text !== "string" ||
      !texts[0].text.trim()
    )
      throw invalidResponse();
    return texts[0].text;
  }
}
