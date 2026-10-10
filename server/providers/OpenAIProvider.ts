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

  // The interface reserves streaming. Enable it after the non-streamed live path is verified.
  // /api/chat never uses this method or exposes unfinished Action Cards.
  stream(_input: ProviderInput): AsyncIterable<string> {
    return unsupportedStream();
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
    if (
      parts.some((part: unknown) => isRecord(part) && part.type === "refusal")
    )
      throw new ProviderError(
        422,
        "The live model could not help with this request. Rephrase it or ask your manager.",
      );
    const output = parts.filter(
      (part: unknown) =>
        isRecord(part) &&
        part.type === "output_text" &&
        typeof part.text === "string",
    );
    if (output.length !== 1 || !output[0].text.trim()) throw invalidResponse();
    return output[0].text;
  }
}
