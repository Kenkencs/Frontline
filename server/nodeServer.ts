import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handleApiRequest, jsonResponse, type ApiOptions } from "./api";

export function createApiServer(options: ApiOptions = {}) {
  return createServer(async (incoming, outgoing) => {
    try {
      // Vite preserves the browser-facing Host header when proxying /api.
      // Use that origin for the same-origin write check, not the backend port.
      const origin = new URL(
        `http://${incoming.headers.host ?? "127.0.0.1:3001"}`,
      );
      if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) {
        outgoing.writeHead(400, { "Content-Type": "application/json" });
        outgoing.end(
          JSON.stringify({ error: "Use the local application address." }),
        );
        incoming.resume();
        return;
      }
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
      const request = new Request(new URL(incoming.url ?? "/", origin), init);
      const response = await handleApiRequest(request, options);
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
