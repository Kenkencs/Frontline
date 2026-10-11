import { useEffect, useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import type { EmployeeRole, Source } from "../../shared/chat";
import type { KnowledgeCatalog } from "../../shared/knowledge";
import { getKnowledge } from "../services/knowledgeClient";
import { roles } from "../data/models";

export function KnowledgePage({
  role,
  onSource,
}: {
  role: EmployeeRole;
  onSource: (source: Source) => void;
}) {
  const [catalog, setCatalog] = useState<KnowledgeCatalog | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    setCatalog(null);
    setError("");
    void getKnowledge(role, controller.signal)
      .then((value) => {
        if (active && !controller.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        // Unmounting or changing roles cancels the old request without updating the new page.
        if (!active) return;
        if (!controller.signal.aborted)
          setError("Could not load current policies. Please retry.");
        else setError("Loading timed out. Please retry.");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [role, reload]);
  const query = search.trim().toLowerCase();
  const entries = (catalog?.documents ?? []).flatMap((doc) =>
    doc.sections.map((source) => ({ doc, source })),
  );
  const filtered = entries.filter(({ doc, source }) =>
    `${doc.title} ${source.question ?? ""} ${source.category ?? ""} ${source.excerpt}`
      .toLowerCase()
      .includes(query),
  );
  return (
    <>
      <div className="page-eyebrow">
        <BookOpen size={18} /> WORKSPACE KNOWLEDGE
      </div>
      <h1>Knowledge Base</h1>
      <p className="page-description">
        {entries.length} current knowledge sections for{" "}
        {roles.find((item) => item.id === role)?.label}. Reviewed FAQ answers
        appear here too.
      </p>
      <div className="information-note">
        {catalog?.mode === "company"
          ? "These approved versions are used by the Knowledge Agent. Confirm situation-specific facts with your manager."
          : catalog?.mode === "sample"
            ? "This workspace currently uses fictional sample policies. They demonstrate retrieval and version checks; they cannot verify real company procedures."
            : "Only current approved policies appear here. Missing or overdue policies require manager verification."}
      </div>
      <label className="knowledge-search">
        Search knowledge
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search policies, questions, or situations"
        />
      </label>
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
        <p role="status">Loading current policies…</p>
      ) : !catalog.documents.length ? (
        <p>
          No current approved policies are available for this role. Ask your
          manager for the relevant document.
        </p>
      ) : (
        <div className="policy-list">
          {!filtered.length && (
            <p>
              No matching knowledge sections. Try another phrase or submit a
              question in FAQs.
            </p>
          )}
          {filtered.map(({ doc, source }) => (
            <button key={source.id} onClick={() => onSource(source)}>
              <span className="policy-icon">
                <FileText size={22} />
              </span>
              <span>
                <strong>{source.question ?? doc.title}</strong>
                <span>
                  {source.category ? `${source.category} · ` : ""}
                  {doc.title} {doc.version} · {source.section} ·{" "}
                  {doc.sample ? "Sample" : "Company"} policy
                </span>
                <span>
                  Effective {doc.effectiveFrom} · Review by {doc.reviewBy}
                </span>
              </span>
              <BookOpen size={17} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
