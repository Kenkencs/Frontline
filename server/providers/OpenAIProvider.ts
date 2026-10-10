import { isRecord } from "../../shared/validation";
import {
  ProviderError,
  type AIProvider,
  type OutputSchema,
  type ProviderInput,
} from "./AIProvider";

const TIMEOUT_MS = 15_000;

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
    const text = await this.request(input, schema);
    try {
      return schema.parse(JSON.parse(text));
    } catch {
      throw new ProviderError(
        502,
        "The live model did not return a valid response. Please retry.",
      );
    }
  }

  // The interface reserves streaming. Enable it after the non-streamed live path is verified.
  // /api/chat never uses this method or exposes unfinished Action Cards.
  async *stream(_input: ProviderInput): AsyncIterable<string> {
    throw new ProviderError(
      501,
      "Streaming is not enabled yet. Use a complete response.",
    );
  }

  private async request(
    input: ProviderInput,
    schema?: OutputSchema<unknown>,
  ): Promise<string> {
    if (!this.apiKey?.trim())
      throw new ProviderError(
        503,
        "Live OpenAI is not configured. Choose a demo model or ask the project owner to configure the backend API key.",
      );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const upstream = await this.fetchImpl(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey.trim()}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
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
          }),
        },
      );
      if (upstream.status === 401 || upstream.status === 403)
        throw new ProviderError(
          503,
          "The live model could not authenticate. Ask the project owner to check the backend API key.",
        );
      if (upstream.status === 429)
        throw new ProviderError(
          429,
          "The live model is unavailable because of an API usage limit. Please retry later.",
        );
      if (!upstream.ok)
        throw new ProviderError(
          502,
          "The live model could not respond. Please retry.",
        );

      const value: unknown = await upstream.json();
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
      if (output.length !== 1 || !output[0].text.trim())
        throw new Error("Unexpected model output");
      return output[0].text;
    } catch (error) {
      if (controller.signal.aborted)
        throw new ProviderError(504, "The live model timed out. Please retry.");
      if (error instanceof ProviderError) throw error;
      if (error instanceof TypeError)
        throw new ProviderError(
          502,
          "Could not reach the live model. Please retry when the backend network is available.",
        );
      throw new ProviderError(
        502,
        "The live model did not return a valid response. Please retry.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
