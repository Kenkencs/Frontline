import { FileText, MessageSquare, UserRound } from "lucide-react";
import type { EmployeeRole, Source } from "../../shared/chat";
import type { EscalationDraft, View } from "../types";
import { KnowledgePage } from "./KnowledgePage";
import { FaqPage } from "./FaqPage";
import { QuestionReview } from "./QuestionReview";
import { ManagerContact } from "./ManagerContact";
import { models, roles } from "../data/models";

interface Props {
  view: Exclude<View, "chat">;
  role: EmployeeRole;
  modelIndex: number;
  drafts: EscalationDraft[];
  onSource: (source: Source) => void;
  onDraft: (text: string) => void;
  onRole: (role: EmployeeRole) => void;
  onModel: (index: number) => void;
  onBack: () => void;
  onAsk: (question: string) => void;
  reviewPrefill: string;
}

export function WorkspacePages({
  view,
  role,
  modelIndex,
  drafts,
  onSource,
  onDraft,
  onRole,
  onModel,
  onBack,
  onAsk,
  reviewPrefill,
}: Props) {
  return (
    <div className="secondary-page">
      {view === "faq" && (
        <FaqPage
          role={role}
          onSource={onSource}
          onAsk={onAsk}
          initialQuestion={reviewPrefill}
        />
      )}
      {view === "knowledge" && (
        <KnowledgePage role={role} onSource={onSource} />
      )}
      {view === "manager" && (
        <>
          <div className="page-eyebrow">
            <UserRound size={18} /> MANAGER WORKSPACE
          </div>
          <h1>Manager Dashboard</h1>
          <QuestionReview />
          <h2 className="drafts-heading">Escalation drafts</h2>
          <p className="page-description">
            Escalation drafts from this session.
          </p>
          <div className="information-note">
            Drafts stay in this browser session. No manager notifications are
            sent, and no manager account is connected.
          </div>
          {drafts.length ? (
            <div className="draft-list">
              {drafts.map((draft) => (
                <article key={draft.id}>
                  <div className="draft-label">
                    <FileText size={17} />
                    Escalation draft<span>Not sent</span>
                  </div>
                  <p>{draft.text}</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      onDraft(draft.text);
                    }}
                  >
                    Open draft
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="secondary-empty">
              <MessageSquare size={30} />
              <h2>No escalation drafts yet</h2>
              <p>
                Use “Prepare handover” on an Action Card to prepare a draft.
              </p>
              <button className="button secondary" onClick={() => onBack()}>
                Back to conversation
              </button>
            </div>
          )}
        </>
      )}
      {view === "settings" && (
        <>
          <div className="page-eyebrow">YOUR PREFERENCES</div>
          <h1>Settings</h1>
          <p className="page-description">
            Set the context for your workplace conversations.
          </p>
          <div className="settings-card">
            <label>
              Employee role
              <select
                value={role}
                onChange={(event) => onRole(event.target.value as EmployeeRole)}
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span>Role provides context; it does not grant permissions.</span>
            </label>
            <label>
              AI model
              <select
                value={modelIndex}
                onChange={(event) => onModel(Number(event.target.value))}
              >
                {models.map((item, index) => (
                  <option key={item.model} value={index}>
                    {item.company} / {item.label} ({item.mode})
                  </option>
                ))}
              </select>
              <span>
                Live models use the selected provider when its backend key is
                configured. Demo selections use local guidance without paid AI.
                All selections use the current knowledge catalog and risk
                checks.
              </span>
            </label>
            <div className="settings-info">
              <strong>Light mode</strong>
              <span>This first version uses a light theme.</span>
            </div>
          </div>
          <div className="information-note">
            API keys belong on the backend. This frontend has no API key fields
            or provider connections.
          </div>
          <h2>Emergency contact</h2>
          <p className="page-description">
            View the manager connection available for this workplace.
          </p>
          <ManagerContact />
        </>
      )}
    </div>
  );
}
