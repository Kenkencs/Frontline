import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handleApiRequest, jsonResponse } from "./api";

export function createApiServer() {
  return createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined)
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const method = incoming.method ?? "GET";
      const init: RequestInit & { duplex?: "half" } = { method, headers };
      if (method !== "GET" && method !== "HEAD") {
        init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
        init.duplex = "half";
      }
      const request = new Request(
        new URL(incoming.url ?? "/", "http://127.0.0.1:3001"),
        init,
      );
      const response = await handleApiRequest(request);
      // Drain unread input after a size rejection without destroying the response socket.
      incoming.resume();
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      const response = jsonResponse(
        { error: "Could not process the request." },
        500,
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    }
  });
}
