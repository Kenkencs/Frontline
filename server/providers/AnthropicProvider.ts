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
  unsupportedStream,
} from "./request";

// Claude supports a smaller schema subset. Keep the original parser and guards
// authoritative; adapt only the schema sent to its API, without mutating it.
function claudeSchema(schema: Record<string, unknown>): Record<string, unknown> {
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

  stream(_input: ProviderInput): AsyncIterable<string> {
    return unsupportedStream();
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
