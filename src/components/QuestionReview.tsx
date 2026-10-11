import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { roles } from "../../shared/catalog";
import type {
  QuestionRecord,
  QuestionStatus,
  ReviewAction,
} from "../../shared/faq";
import { getQuestions, reviewQuestion } from "../services/faqClient";
import "../faq.css";

function utcDay(days = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ReviewForm({
  question,
  onReviewed,
}: {
  question: QuestionRecord;
  onReviewed: (record: QuestionRecord) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const [reviewBy, setReviewBy] = useState(utcDay(90));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function review(action: ReviewAction) {
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    try {
      const record = await reviewQuestion(question.id, action, request.signal);
      if (!request.signal.aborted) onReviewed(record);
    } catch (reason) {
      if (!request.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not confirm that the review was saved.",
        );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void review({
      action: "publish",
      answer,
      category,
      source_reference: reference,
      review_by: reviewBy,
    });
  }
  const prefix = `review-${question.id}`;
  return (
    <form className="review-form" onSubmit={publish}>
      <label htmlFor={`${prefix}-answer`}>Reviewed answer</label>
      <textarea
        id={`${prefix}-answer`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={5}
        maxLength={4000}
        required
        disabled={busy}
        placeholder="Write a clear procedure. Do not grant unverified safety or permission."
      />
      <span className="review-character-count">{answer.length}/4000</span>
      <div className="review-fields">
        <label>
          Category
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={60}
            required
            disabled={busy}
            placeholder="e.g. Opening shift"
          />
        </label>
        <label>
          Review by
          <input
            type="date"
            value={reviewBy}
            onChange={(event) => setReviewBy(event.target.value)}
            min={utcDay(1)}
            max={utcDay(365)}
            required
            disabled={busy}
          />
        </label>
      </div>
      <label htmlFor={`${prefix}-source`}>Source reference</label>
      <input
        id={`${prefix}-source`}
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        maxLength={200}
        required
        disabled={busy}
        placeholder="Document title, version, and section"
      />
      <p className="review-help">
        Include an explicit source reference. Review dates use UTC and must be
        within the next 365 days. Published answers remain sample knowledge.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        <button
          className="button primary"
          type="submit"
          disabled={
            busy ||
            !answer.trim() ||
            !category.trim() ||
            !reference.trim() ||
            !reviewBy
          }
        >
          <Check size={15} />
          {busy ? "Saving review…" : "Publish to FAQ"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => void review({ action: "reject" })}
        >
          <X size={15} /> Reject
        </button>
      </div>
    </form>
  );
}

export function QuestionReview() {
  const [status, setStatus] = useState<QuestionStatus>("pending");
  const [questions, setQuestions] = useState<QuestionRecord[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setQuestions(null);
    setError("");
    void getQuestions(status, controller.signal)
      .then((value) => {
        if (active) setQuestions(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load questions. Please retry.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [status, reload]);
  function reviewed(record: QuestionRecord) {
    setNotice(
      record.status === "published"
        ? "Answer published to the FAQ as sample knowledge."
        : "Question rejected. No answer was published.",
    );
    setReload((value) => value + 1);
  }
  return (
    <section className="review-section" aria-labelledby="review-title">
      <h2 id="review-title">
        <MessageSquare size={21} /> Question review
      </h2>
      <p className="review-scope">
        Owner-private prototype · Reviewed answers remain sample knowledge
      </p>
      <div className="review-tabs" aria-label="Question status">
        {(["pending", "published", "rejected"] as const).map((item) => (
          <button
            key={item}
            className={status === item ? "review-tab-active" : ""}
            aria-pressed={status === item}
            onClick={() => {
              setStatus(item);
              setNotice("");
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {notice && (
        <p className="faq-success" role="status">
          {notice}
        </p>
      )}
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
      ) : !questions ? (
        <p className="review-empty" role="status">
          Loading {status} questions…
        </p>
      ) : !questions.length ? (
        <p className="review-empty">No {status} questions.</p>
      ) : (
        <div className="review-list">
          {questions.map((question) => (
            <article className="review-card" key={question.id}>
              <div className="review-meta">
                <span>
                  {
                    roles.find((role) => role.id === question.employee_role)
                      ?.label
                  }
                </span>
                <span className="review-status">{question.status}</span>
              </div>
              <h3>{question.question}</h3>
              <p className="review-date">
                Submitted {new Date(question.created_at).toLocaleDateString()}
              </p>
              {question.status === "pending" ? (
                <ReviewForm question={question} onReviewed={reviewed} />
              ) : question.status === "published" ? (
                <div className="review-published">
                  <p>{question.answer}</p>
                  <span>
                    {question.category} · {question.source_reference}
                  </span>
                  <span>Review by {question.review_by} · Sample knowledge</span>
                </div>
              ) : (
                <p className="review-help">
                  Closed without publishing an answer.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
