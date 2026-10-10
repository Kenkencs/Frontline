import type { AIProvider, OutputSchema, ProviderInput } from "./AIProvider";
import { jsonSystemPrompt, readChatCompletion } from "./chatCompletion";
import { parseStructured, requestJson, unsupportedStream } from "./request";

export class DeepSeekProvider implements AIProvider {
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
        providerName: "DeepSeek",
        apiKey: this.apiKey,
        url: "https://api.deepseek.com/chat/completions",
        body: {
          model: input.model,
          messages: [
            { role: "system", content: jsonSystemPrompt(input, schema) },
            { role: "user", content: input.prompt },
          ],
          thinking: { type: "disabled" },
          max_tokens: input.maxOutputTokens ?? 1200,
          stream: false,
          ...(schema ? { response_format: { type: "json_object" } } : {}),
        },
      },
      this.fetchImpl,
    );
    return readChatCompletion(value);
  }
}
