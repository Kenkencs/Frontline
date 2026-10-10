import {
  MAX_BODY_BYTES,
  parseChatRequest,
  parseChatResponse,
} from "../shared/validation";
import { getMockResponse } from "./mockChat";

export function jsonResponse(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

class BodyTooLarge extends Error {}

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES)
    throw new BodyTooLarge();
  if (!request.body) throw new Error("empty body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new BodyTooLarge();
      chunks.push(value);
    }
  } finally {
    // Cancelling Node's request stream destroys its socket before we can send a 413.
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// One portable handler used by the local Node server and the hosted Worker.
export async function handleApiRequest(request: Request): Promise<Response> {
  if (new URL(request.url).pathname !== "/api/chat")
    return jsonResponse({ error: "API route not found." }, 404);
  if (request.method !== "POST")
    return jsonResponse({ error: "Use POST /api/chat." }, 405, {
      Allow: "POST",
    });
  const contentType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    return jsonResponse({ error: "Send application/json." }, 415);

  let value: unknown;
  try {
    value = await readJson(request);
  } catch (error) {
    return error instanceof BodyTooLarge
      ? jsonResponse({ error: "Request body must be at most 32 KiB." }, 413)
      : jsonResponse({ error: "Send valid JSON." }, 400);
  }

  let input;
  try {
    input = parseChatRequest(value);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Invalid chat request.",
      },
      400,
    );
  }

  try {
    return jsonResponse(parseChatResponse(getMockResponse(input)));
  } catch {
    // Do not expose internal errors, keys, or worker questions.
    return jsonResponse(
      { error: "Could not prepare a response. Please retry." },
      500,
    );
  }
}
