import {
  AlertTriangle,
  BookOpen,
  Check,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ActionResponse, Source } from "../../shared/chat";

export function SourceLinks({
  sources,
  onSource,
}: {
  sources: Source[];
  onSource: (source: Source) => void;
}) {
  return (
    <div className="source-links">
      {sources.map((source) => (
        <button key={source.id} onClick={() => onSource(source)}>
          <BookOpen size={14} />
          <span>
            {source.title} {source.version}{" "}
            <span className="source-section">{source.section}</span>
            {source.sample !== false && (
              <span className="source-section"> · Sample</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ActionCard({
  response,
  onSource,
  onEscalate,
}: {
  response: ActionResponse;
  mode: "demo" | "live";
  onSource: (source: Source) => void;
  onEscalate: () => void;
}) {
  const companyEvidence =
    response.sources.length > 0 &&
    response.sources.every((source) => source.sample === false);
  return (
    <section
      className={`action-card risk-${response.risk}`}
      aria-label={`${response.risk} risk action card`}
    >
      <div className="risk-strip">
        <span>
          <AlertTriangle size={17} /> {response.risk.toUpperCase()} RISK
        </span>
        <span className="risk-note">
          {response.escalate
            ? "Manager escalation recommended"
            : "Check the procedure before acting"}
        </span>
      </div>
      <div className="action-card-body">
        <div className="section-eyebrow">SITUATION</div>
        <h2>{response.summary}</h2>
        <div className="section-eyebrow actions-heading">
          RECOMMENDED ACTIONS
        </div>
        <ol className="action-list">
          {response.actions.map((action, index) => (
            <li key={action}>
              <span className="step-number">{index + 1}</span>
              <span>{action}</span>
            </li>
          ))}
        </ol>
        <div className="sources-block">
          <div className="section-eyebrow">
            SOURCES{" "}
            {!!response.sources.length && !companyEvidence && (
              <span>Sample policies</span>
            )}
          </div>
          <SourceLinks sources={response.sources} onSource={onSource} />
          {!response.sources.length && (
            <p className="source-section">
              No relevant current policy found. Verify guidance with your
              manager.
            </p>
          )}
        </div>
      </div>
      <div className="action-card-footer">
        <div
          className="confidence"
          title={
            companyEvidence
              ? "Confidence concerns the retrieved procedure, never a guarantee of safety."
              : "Sample or missing company evidence requires manager verification. This is not a safety guarantee."
          }
        >
          <ShieldCheck size={17} />
          <span>
            Confidence: <strong>{response.confidence}</strong>
          </span>
          <Check size={13} />
        </div>
        <div className="card-buttons">
          <button
            className="button secondary"
            onClick={() => response.sources[0] && onSource(response.sources[0])}
            disabled={!response.sources.length}
          >
            <BookOpen size={15} />
            View Source
          </button>
          {response.escalate && (
            <button className="button primary" onClick={onEscalate}>
              <UserRound size={15} />
              Ask Manager
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
