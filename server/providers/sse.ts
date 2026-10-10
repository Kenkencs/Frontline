// SSE framing only. Provider adapters decide which JSON events contain text.
export interface ServerEvent {
  event: string;
  data: string;
}

export async function* readServerEvents(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  let eventSize = 0;
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      buffer += chunk.done
        ? decoder.decode()
        : decoder.decode(chunk.value, { stream: true });
      // Bound a damaged or never-terminated event; never include it in errors.
      if (buffer.length + eventSize > 64 * 1024)
        throw new Error("Invalid SSE frame");
      let end: number;
      while ((end = buffer.search(/[\r\n]/)) !== -1) {
        // A CR at a network boundary may be the first half of CRLF.
        if (!chunk.done && end === buffer.length - 1 && buffer[end] === "\r")
          break;
        const line = buffer.slice(0, end);
        const separator =
          buffer[end] === "\r" && buffer[end + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(end + separator);
        if (!line) {
          if (data.length) yield { event, data: data.join("\n") };
          event = "message";
          data = [];
          eventSize = 0;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          const value =
            colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          if (field === "data") {
            data.push(value);
            eventSize += value.length;
            if (eventSize > 64 * 1024) throw new Error("Invalid SSE frame");
          }
        }
      }
      // SSE requires a blank line to dispatch. Discard an unfinished last frame;
      // the adapter then reports the missing completion marker.
      if (chunk.done) return;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
