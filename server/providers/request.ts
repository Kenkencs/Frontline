import { isRecord } from "../../shared/validation";
import { ProviderError, type OutputSchema } from "./AIProvider";
import { readServerEvents, type ServerEvent } from "./sse";

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

export function refusedResponse(): ProviderError {
  return new ProviderError(
    422,
    "The live model could not help with this request. Rephrase it or ask your manager.",
  );
}

function requestError(error: unknown, signal: AbortSignal): ProviderError {
  if (signal.aborted)
    return new ProviderError(504, "The live model timed out. Please retry.");
  if (error instanceof ProviderError) return error;
  if (error instanceof TypeError)
    return new ProviderError(
      502,
      "Could not reach the live model. Please retry when the backend network is available.",
    );
  return invalidResponse();
}

async function postRequest(
  options: ProviderRequest,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const key = options.apiKey?.trim();
  if (!key)
    throw new ProviderError(
      503,
      `Live ${options.providerName} is not configured. Choose a demo model or ask the project owner to configure the backend API key.`,
    );
  const upstream = await fetchImpl(options.url, {
    method: "POST",
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      ...(options.keyHeader
        ? { [options.keyHeader]: key }
        : { Authorization: `Bearer ${key}` }),
    },
    signal,
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
  // Inspect only Kimi's filter category, never return upstream diagnostics.
  if (upstream.status === 400) {
    const value: unknown = await upstream.json().catch(() => null);
    if (
      isRecord(value) &&
      isRecord(value.error) &&
      value.error.type === "content_filter"
    )
      throw refusedResponse();
  }
  if (!upstream.ok)
    throw new ProviderError(
      502,
      "The live model could not respond. Please retry.",
    );
  return upstream;
}

// Shared HTTP plumbing only. Adapters still own their provider-specific payloads.
export async function requestJson(
  options: ProviderRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await postRequest(options, controller.signal, fetchImpl);
    return await upstream.json();
  } catch (error) {
    throw requestError(error, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Keep the deadline until body consumption ends, not just until headers arrive.
// Breaking out of a consumer's for-await loop closes this generator and aborts
// the request, so no paid generation continues after the caller stops reading.
export async function* requestStream(
  options: ProviderRequest,
  fetchImpl: typeof fetch = fetch,
): AsyncIterable<ServerEvent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await postRequest(options, controller.signal, fetchImpl);
    const mediaType = upstream.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!upstream.body || mediaType !== "text/event-stream")
      throw invalidResponse();
    for await (const event of readServerEvents(
      upstream.body,
      controller.signal,
    )) {
      if (controller.signal.aborted)
        throw requestError(null, controller.signal);
      yield event;
    }
    if (controller.signal.aborted) throw requestError(null, controller.signal);
  } catch (error) {
    throw requestError(error, controller.signal);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export function eventJson(event: ServerEvent): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(event.data);
    if (!isRecord(value)) throw invalidResponse();
    // Named SSE events and their JSON type must agree. In particular, a named
    // error event must never be mistaken for a piece of assistant text.
    if (event.event !== "message" && event.event !== value.type)
      throw invalidResponse();
    return value;
  } catch {
    throw invalidResponse();
  }
}

export function parseStructured<T>(text: string, schema: OutputSchema<T>): T {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw invalidResponse();
  }
}
