import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const suggestions = [
  "A customer has a food allergy",
  "Opening shift checklist",
  "Handling a customer complaint",
];

export function ChatComposer({
  sending,
  onSend,
  mode,
}: {
  sending: boolean;
  onSend: (message: string) => Promise<void>;
  mode: "demo" | "live";
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 180)}px`;
    }
  }, [text]);
  const submit = async () => {
    if (!text.trim() || sending) return;
    const message = text.trim();
    setText("");
    await onSend(message);
    input.current?.focus();
  };
  return (
    <div className="composer-area">
      <div className="suggestion-row">
        {suggestions.map((suggestion) => (
          <button
            disabled={sending}
            key={suggestion}
            onClick={() => {
              setText(suggestion);
              input.current?.focus();
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor="message-input">
          Your workplace question
        </label>
        <textarea
          id="message-input"
          ref={input}
          value={text}
          maxLength={4000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask a question about your work…"
          rows={2}
          disabled={sending}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="composer-toolbar">
          <span>
            {text.length > 3500
              ? `${text.length} / 4,000`
              : "Enter to send · Shift + Enter for a new line"}
          </span>
          <button
            className="send-button"
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
      <p className="composer-footnote">
        {mode === "demo"
          ? "Local demo guidance · Check sources · Verify with your manager"
          : "AI guidance · Check sources · Verify with your manager"}
      </p>
    </div>
  );
}
