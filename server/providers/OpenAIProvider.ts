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

export class OpenAIProvider implements AIProvider {
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

  // /api/chat uses structuredGenerate; these text chunks are never Action Cards.
  async *stream(input: ProviderInput): AsyncIterable<string> {
    let text = "";
    let textPart: string | undefined;
    const events = requestStream(
      {
        providerName: "OpenAI",
        apiKey: this.apiKey,
        url: "https://api.openai.com/v1/responses",
        body: {
          model: input.model,
          instructions: input.systemPrompt,
          input: input.prompt,
          store: false,
          max_output_tokens: input.maxOutputTokens ?? 1200,
          stream: true,
        },
      },
      this.fetchImpl,
    );
    for await (const event of events) {
      const value = eventJson(event);
      if (typeof value.type !== "string") throw invalidResponse();
      if (value.type.startsWith("response.refusal.")) throw refusedResponse();
      if (
        ["error", "response.failed", "response.incomplete"].includes(value.type)
      )
        throw invalidResponse();
      if (
        value.type === "response.output_item.added" &&
        isRecord(value.item) &&
        !["message", "reasoning"].includes(value.item.type as string)
      )
        throw invalidResponse();
      if (
        value.type === "response.content_part.added" &&
        isRecord(value.part) &&
        value.part.type === "refusal"
      )
        throw refusedResponse();
      if (value.type === "response.output_text.delta") {
        if (
          typeof value.delta !== "string" ||
          typeof value.item_id !== "string" ||
          !Number.isInteger(value.content_index)
        )
          throw invalidResponse();
        const part = `${value.item_id}:${value.content_index}`;
        if (textPart !== undefined && textPart !== part)
          throw invalidResponse();
        textPart = part;
        text += value.delta;
        if (value.delta) yield value.delta;
      }
      if (value.type === "response.completed") {
        if (
          !isRecord(value.response) ||
          !Array.isArray(value.response.output) ||
          value.response.output.some(
            (item: unknown) =>
              !isRecord(item) ||
              !["message", "reasoning"].includes(item.type as string),
          )
        )
          throw invalidResponse();
        if (readResponseText(value.response) !== text || !text.trim())
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
        providerName: "OpenAI",
        apiKey: this.apiKey,
        url: "https://api.openai.com/v1/responses",
        body: {
          model: input.model,
          instructions: input.systemPrompt,
          input: input.prompt,
          store: false,
          max_output_tokens: input.maxOutputTokens ?? 1200,
          ...(schema
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: schema.name,
                    strict: true,
                    schema: schema.jsonSchema,
                  },
                },
              }
            : {}),
        },
      },
      this.fetchImpl,
    );
    return readResponseText(value);
  }
}

function readResponseText(value: unknown): string {
  if (
    !isRecord(value) ||
    value.status !== "completed" ||
    !Array.isArray(value.output)
  )
    throw new ProviderError(
      502,
      "The live model returned an incomplete response. Please retry.",
    );
  const parts = value.output.flatMap((item: unknown) =>
    isRecord(item) && item.type === "message" && Array.isArray(item.content)
      ? item.content
      : [],
  );
  if (parts.some((part: unknown) => isRecord(part) && part.type === "refusal"))
    throw refusedResponse();
  const output = parts.filter(
    (part: unknown) =>
      isRecord(part) &&
      part.type === "output_text" &&
      typeof part.text === "string",
  );
  if (output.length !== 1 || !output[0].text.trim()) throw invalidResponse();
  return output[0].text;
}
