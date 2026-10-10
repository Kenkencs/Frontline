// Plain application types. No provider SDK types or environment variables here.
export interface ProviderInput {
  model: string;
  systemPrompt: string;
  prompt: string;
  maxOutputTokens?: number;
}

export interface OutputSchema<T> {
  name: string;
  jsonSchema: Record<string, unknown>;
  parse(value: unknown): T;
}

export interface AIProvider {
  generate(input: ProviderInput): Promise<string>;
  structuredGenerate<T>(
    input: ProviderInput,
    schema: OutputSchema<T>,
  ): Promise<T>;
  stream(input: ProviderInput): AsyncIterable<string>;
}

// Adapters use only safe, application-written messages; never raw provider errors.
export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
