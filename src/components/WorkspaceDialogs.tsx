import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Copy, Plus, UserRound, X } from "lucide-react";
import type { Source } from "../../shared/chat";

// Native dialogs provide focus trapping and Escape handling without another UI dependency.
export function SourceDialog({
  source,
  onClose,
}: {
  source: Source | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (source) dialog.current?.showModal();
    else dialog.current?.close();
  }, [source]);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="source-title"
    >
      <div className="modal-header">
        <span className="page-eyebrow">
          <BookOpen size={17} />
          SAMPLE SOURCE
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close source"
        >
          <X size={20} />
        </button>
      </div>
      {source && (
        <>
          <h2 id="source-title">{source.title}</h2>
          <p className="source-meta">
            {source.version} · {source.section} · Fictional policy excerpt
          </p>
          <blockquote>{source.excerpt}</blockquote>
          <div className="information-note">
            This sample has not been verified against any company’s current
            policy. It does not confirm that a specific food is safe.
          </div>
        </>
      )}
    </dialog>
  );
}

interface DraftProps {
  text: string | null;
  onChange: (text: string) => void;
  onClose: () => void;
  onSave: (text: string) => void;
  onNotice: (text: string) => void;
}

export function EscalationDialog({
  text,
  onChange,
  onClose,
  onSave,
  onNotice,
}: DraftProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
    if (text !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [text]);
  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      setCopied(true);
    } catch {
      onNotice("Copy unavailable. Select and copy the note manually.");
    }
  };
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="draft-title"
    >
      <div className="modal-header">
        <span className="page-eyebrow">
          <UserRound size={17} />
          ESCALATION DRAFT
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close escalation draft"
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="draft-title">Ask your manager</h2>
      <p className="source-meta">
        Review the note, then copy it to your usual channel. Nothing is sent
        from this prototype.
      </p>
      <label className="sr-only" htmlFor="draft-text">
        Message to your manager
      </label>
      <textarea
        id="draft-text"
        className="draft-editor"
        value={text ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="modal-actions">
        <button
          className="button secondary"
          disabled={!text?.trim()}
          onClick={() => text?.trim() && onSave(text)}
        >
          <Plus size={15} />
          Save draft
        </button>
        <button
          className="button primary"
          disabled={!text?.trim()}
          onClick={() => void copyNote()}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy note"}
        </button>
      </div>
    </dialog>
  );
}
