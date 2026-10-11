import { roles } from "../../shared/catalog";
import {
  parseReviewQuestion,
  parseSubmitQuestion,
  type QuestionStatus,
} from "../../shared/faq";
import { MAX_BODY_BYTES } from "../../shared/validation";
import { FaqStoreError, unavailableStore, type FaqStore } from "./store";

function json(value: unknown, status = 200, allow?: string): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(allow ? { Allow: allow } : {}),
    },
  });
}
class BodyTooLarge extends Error {}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES)
    throw new BodyTooLarge();
  if (!request.body) throw new Error("No body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new BodyTooLarge();
      chunks.push(value);
    }
  } finally {
    // Do not cancel Node's request stream: that would close its response socket.
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function handleQuestionRequest(
  request: Request,
  store?: FaqStore,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const item = /^\/api\/questions\/([^/]+)$/.exec(url.pathname);
  const collection = url.pathname === "/api/questions";
  if (!collection && !item) return json({ error: "API route not found." }, 404);
  if (request.method !== "POST" && !(collection && request.method === "GET"))
    return json(
      {
        error: collection
          ? "Use GET or POST /api/questions."
          : "Use POST to review a question.",
      },
      405,
      collection ? "GET, POST" : "POST",
    );

  if (request.method === "GET") {
    const roleValue = url.searchParams.get("employee_role");
    const role = roles.find((entry) => entry.id === roleValue);
    if (roleValue !== null && !role)
      return json({ error: "Choose a supported employee role." }, 400);
    const status = url.searchParams.get("status") ?? "pending";
    if (!["pending", "published", "rejected"].includes(status))
      return json(
        { error: "Choose pending, published, or rejected questions." },
        400,
      );
    try {
      if (!store) throw unavailableStore();
      return json({
        questions: await store.list(role?.id, status as QuestionStatus),
      });
    } catch {
      return json({ error: unavailableStore().message }, 503);
    }
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== url.origin)
    return json({ error: "Submit this request from the application." }, 403);
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return json({ error: "Send application/json." }, 415);
  let value: unknown;
  try {
    value = await readBody(request);
  } catch (error) {
    return error instanceof BodyTooLarge
      ? json({ error: "Request body must be at most 32 KiB." }, 413)
      : json({ error: "Send valid JSON." }, 400);
  }

  let id: string | undefined;
  if (item) {
    try {
      id = decodeURIComponent(item[1]);
    } catch {
      return json({ error: "Choose a valid question." }, 400);
    }
    if (!id.trim() || id.length > 100 || /[\x00-\x1f/]/.test(id))
      return json({ error: "Choose a valid question." }, 400);
  }
  let input;
  try {
    input =
      id === undefined
        ? parseSubmitQuestion(value)
        : parseReviewQuestion(value, now);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Invalid question." },
      400,
    );
  }

  try {
    if (!store) throw unavailableStore();
    if (id === undefined) {
      // The parsed shape is reconstructed; client status/id fields are ignored.
      const question = await store.submit(parseSubmitQuestion(input), now);
      return json({ question }, 201);
    }
    const review = parseReviewQuestion(input, now);
    const question =
      review.action === "reject"
        ? await store.reject(id)
        : await store.publish(id, review, now);
    return json({ question });
  } catch (error) {
    if (error instanceof FaqStoreError)
      return json({ error: error.message }, error.status);
    // Database errors can contain SQL and connection details; never forward them.
    return json({ error: unavailableStore().message }, 503);
  }
}
