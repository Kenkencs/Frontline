import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EmployeeRole } from "../../shared/chat";
import { getFaq } from "../services/faqClient";
import { roles } from "../data/models";

export function ChatComposer({
  sending,
  onSend,
  mode,
  role,
  initialQuestion,
  onBrowseFaq,
}: {
  sending: boolean;
  onSend: (message: string) => Promise<void>;
  mode: "demo" | "live";
  role: EmployeeRole;
  initialQuestion: string;
  onBrowseFaq: () => void;
}) {
  const [text, setText] = useState(initialQuestion);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    setSuggestions([]);
    setSuggestionOffset(0);
    void getFaq(role, controller.signal)
      .then((value) => {
        if (active && !controller.signal.aborted)
          setSuggestions(value.faqs.map((faq) => faq.question));
      })
      .catch(() => {
        /* The composer stays usable when FAQ suggestions are unavailable. */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [role]);
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
      <div className="suggestion-heading">
        <span>For {roles.find((item) => item.id === role)?.label}</span>
        <div>
          {suggestions.length > 3 && (
            <button
              onClick={() =>
                setSuggestionOffset((value) => (value + 3) % suggestions.length)
              }
            >
              More questions
            </button>
          )}
          <button onClick={onBrowseFaq}>Browse FAQs</button>
        </div>
      </div>
      <div className="suggestion-row">
        {suggestions
          .slice(suggestionOffset, suggestionOffset + 3)
          .map((suggestion) => (
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
