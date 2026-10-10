import { isRecord } from "../../shared/validation";
import { ProviderError, type OutputSchema } from "./AIProvider";

interface ProviderRequest {
  providerName: string;
  apiKey: string | undefined;
  url: string;
  keyHeader?: "x-api-key";
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

export function invalidResponse(): ProviderError {
  return new ProviderError(
    502,
    "The live model did not return a valid response. Please retry.",
  );
}

// Shared HTTP plumbing only. Adapters still own their provider-specific payloads.
export async function requestJson(
  options: ProviderRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const key = options.apiKey?.trim();
  if (!key)
    throw new ProviderError(
      503,
      `Live ${options.providerName} is not configured. Choose a demo model or ask the project owner to configure the backend API key.`,
    );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await fetchImpl(options.url, {
      method: "POST",
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        ...(options.keyHeader
          ? { [options.keyHeader]: key }
          : { Authorization: `Bearer ${key}` }),
      },
      signal: controller.signal,
      body: JSON.stringify(options.body),
    });
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
    // Kimi reports filtered requests as HTTP 400. Inspect only the error type;
    // never forward the provider's message or other diagnostic fields.
    if (upstream.status === 400) {
      const value: unknown = await upstream.json().catch(() => null);
      if (
        isRecord(value) &&
        isRecord(value.error) &&
        value.error.type === "content_filter"
      )
        throw new ProviderError(
          422,
          "The live model could not help with this request. Rephrase it or ask your manager.",
        );
    }
    if (!upstream.ok)
      throw new ProviderError(
        502,
        "The live model could not respond. Please retry.",
      );
    return await upstream.json();
  } catch (error) {
    if (controller.signal.aborted)
      throw new ProviderError(504, "The live model timed out. Please retry.");
    if (error instanceof ProviderError) throw error;
    if (error instanceof TypeError)
      throw new ProviderError(
        502,
        "Could not reach the live model. Please retry when the backend network is available.",
      );
    throw invalidResponse();
  } finally {
    clearTimeout(timer);
  }
}

export function parseStructured<T>(text: string, schema: OutputSchema<T>): T {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw invalidResponse();
  }
}

export async function* unsupportedStream(): AsyncIterable<string> {
  throw new ProviderError(
    501,
    "Streaming is not enabled yet. Use a complete response.",
  );
}
