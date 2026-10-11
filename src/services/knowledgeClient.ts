import type { EmployeeRole } from "../../shared/chat";
import type { KnowledgeCatalog } from "../../shared/knowledge";
import { isRecord, isSource } from "../../shared/validation";

// Read only the backend's current, approved catalog. Never bundle company SOPs in React.
export async function getKnowledge(
  role: EmployeeRole,
  signal: AbortSignal,
): Promise<KnowledgeCatalog> {
  const response = await fetch(
    `/api/knowledge?employee_role=${encodeURIComponent(role)}`,
    { signal },
  );
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error("Could not load the knowledge base. Please retry.");
  if (
    !isRecord(value) ||
    !["sample", "company", "none"].includes(value.mode as string) ||
    !Array.isArray(value.documents) ||
    !value.documents.every(
      (doc) =>
        isRecord(doc) &&
        typeof doc.documentId === "string" &&
        typeof doc.title === "string" &&
        typeof doc.version === "string" &&
        Number.isInteger(doc.revision) &&
        typeof doc.effectiveFrom === "string" &&
        typeof doc.reviewBy === "string" &&
        typeof doc.sample === "boolean" &&
        Array.isArray(doc.sections) &&
        doc.sections.every(
          (section) =>
            isSource(section) &&
            isRecord(section) &&
            (section.question === undefined ||
              typeof section.question === "string") &&
            (section.category === undefined ||
              typeof section.category === "string"),
        ),
    )
  )
    throw new Error("The server returned an invalid knowledge catalog.");
  return value as unknown as KnowledgeCatalog;
}
