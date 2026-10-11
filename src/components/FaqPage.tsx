import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, MessageSquarePlus, Search } from "lucide-react";
import type { EmployeeRole, Source } from "../../shared/chat";
import { roles } from "../../shared/catalog";
import type { FaqCatalog } from "../../shared/faq";
import { getFaq, submitQuestion } from "../services/faqClient";
import "../faq.css";

interface Props {
  role: EmployeeRole;
  onSource: (source: Source) => void;
  onAsk: (question: string) => void;
  initialQuestion?: string;
}

export function FaqPage({
  role,
  onSource,
  onAsk,
  initialQuestion = "",
}: Props) {
  const [catalog, setCatalog] = useState<FaqCatalog | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState(initialQuestion);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState("");
  const submission = useRef<AbortController | null>(null);
  const activeRole = useRef(role);

  useEffect(() => {
    activeRole.current = role;
    setQuestion(initialQuestion);
    setSaved("");
    setSaveError("");
    setSaving(false);
    return () => submission.current?.abort();
  }, [role, initialQuestion]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setCatalog(null);
    setError("");
    setCategory("");
    void getFaq(role, controller.signal)
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load FAQs. Please retry.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [role, reload]);

  const items = catalog?.faqs ?? [];
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const needle = search.trim().toLocaleLowerCase();
  const visible = items.filter(
    (item) =>
      (!category || item.category === category) &&
      `${item.question} ${item.answer} ${item.category}`
        .toLocaleLowerCase()
        .includes(needle),
  );
  const roleLabel = roles.find((item) => item.id === role)?.label ?? role;

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const controller = new AbortController();
    submission.current = controller;
    const submittedRole = role;
    setSaving(true);
    setSaveError("");
    setSaved("");
    try {
      await submitQuestion(
        { question, employee_role: role },
        controller.signal,
      );
      if (!controller.signal.aborted && activeRole.current === submittedRole) {
        setQuestion("");
        setSaved(
          "Question saved for manager review. It has not been published to the FAQ or knowledge base.",
        );
      }
    } catch (reason) {
      if (!controller.signal.aborted && activeRole.current === submittedRole)
        setSaveError(
          reason instanceof Error
            ? reason.message
            : "Could not confirm that the question was saved.",
        );
    } finally {
      if (!controller.signal.aborted && activeRole.current === submittedRole)
        setSaving(false);
    }
  }

  return (
    <section className="faq-page">
      <div className="page-eyebrow">
        <BookOpen size={18} /> WORKPLACE FAQ
      </div>
      <h1>Answers for your shift</h1>
      <p className="page-description">
        Browse common questions before starting a conversation.
      </p>
      <div className="information-note">
        Sample guidance for learning and review. Confirm your company's current
        procedure with the manager before acting.
      </div>
      <div className="faq-toolbar">
        <label className="faq-search">
          <span className="sr-only">
            Search questions, answers, and categories
          </span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workplace questions…"
          />
        </label>
        <label className="faq-category">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry loading
          </button>
        </div>
      ) : !catalog ? (
        <p className="faq-count" role="status">
          Loading FAQs for {roleLabel}…
        </p>
      ) : (
        <>
          <p className="faq-count" role="status">
            {visible.length} of {items.length} questions · {roleLabel}
          </p>
          {visible.length ? (
            <div className="faq-list">
              {visible.map((item) => (
                <details className="faq-item" key={item.id}>
                  <summary>
                    <span>
                      <span className="faq-item-category">{item.category}</span>
                      {item.question}
                    </span>
                    <span className="faq-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </summary>
                  <div className="faq-answer">
                    <span className="faq-sample-label">
                      {item.source.sample === false
                        ? "Company procedure"
                        : "Sample guidance"}
                    </span>
                    <p>{item.answer}</p>
                    <p className="faq-source-reference">
                      {item.source_reference} · Review by {item.review_by}
                    </p>
                    <div className="faq-actions">
                      <button
                        className="button secondary"
                        onClick={() => onSource(item.source)}
                      >
                        <BookOpen size={15} /> View Source
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => onAsk(item.question)}
                      >
                        Ask this question
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="faq-empty">
              {items.length
                ? "No questions match this search. Try another term or submit your question below."
                : "No current FAQs are available for this role. Submit a question for review below."}
            </p>
          )}
        </>
      )}
      <form className="faq-submit" onSubmit={sendQuestion}>
        <h2>
          <MessageSquarePlus size={20} /> Can't find an answer?
        </h2>
        <p>
          Submit a workplace question for manager review. Submission does not
          publish knowledge.
        </p>
        <label htmlFor="faq-question">
          Your question <span>For {roleLabel}</span>
        </label>
        <textarea
          id="faq-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={1000}
          required
          disabled={saving}
          rows={4}
          placeholder="What procedure do you need help with?"
          aria-describedby="faq-question-help"
        />
        <div className="faq-form-help">
          <span id="faq-question-help">
            Review your question before submitting. Keep it within 1,000
            characters and leave out customer names, contact details, and other
            personal data.
          </span>
          <span>{question.length}/1000</span>
        </div>
        {saveError && (
          <p className="error-message" role="alert">
            {saveError}
          </p>
        )}
        {saved && (
          <p className="faq-success" role="status">
            {saved}
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={saving || !question.trim() || question.length > 1000}
        >
          {saving ? "Saving question…" : "Submit for review"}
        </button>
      </form>
    </section>
  );
}
