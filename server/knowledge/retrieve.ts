import type { EmployeeRole, Source } from "../../shared/chat";
import { knowledgeDocuments } from "./documents";
import type { KnowledgeDocument, KnowledgeResult } from "./types";

const stopWords = new Set(
  "a an the and or but to of for in on at is it this that can could should what how do does i me my we our you your he she they has have with says said please help need customer customers worker employee manager".split(
    " ",
  ),
);
function terms(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((word) => !stopWords.has(word));
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// Select versions before roles, expiry, or keywords: a retired/expired newest
// effective revision must never resurrect an older approved policy.
export function getCurrentDocuments(
  documents = knowledgeDocuments,
  now = new Date(),
  role?: EmployeeRole,
): KnowledgeDocument[] {
  if (!Number.isFinite(now.getTime())) return [];
  const today = now.toISOString().slice(0, 10);
  const latest = new Map<string, KnowledgeDocument>();
  const ambiguous = new Set<string>();
  for (const document of documents) {
    if (
      document.status === "draft" ||
      !document.documentId.trim() ||
      !Number.isInteger(document.revision) ||
      document.revision < 1 ||
      !validDate(document.effectiveFrom) ||
      document.effectiveFrom > today
    )
      continue;
    const previous = latest.get(document.documentId);
    if (!previous || document.revision > previous.revision) {
      latest.set(document.documentId, document);
      ambiguous.delete(document.documentId);
    } else if (document.revision === previous.revision)
      ambiguous.add(document.documentId);
  }
  return [...latest.values()].filter(
    (document) =>
      !ambiguous.has(document.documentId) &&
      document.status === "approved" &&
      validDate(document.reviewBy) &&
      document.reviewBy >= today &&
      document.title.trim() &&
      document.version.trim() &&
      (!role || document.roles.includes(role)),
  );
}

export function retrieveKnowledge(
  message: string,
  role: EmployeeRole,
  documents = knowledgeDocuments,
  now = new Date(),
): KnowledgeResult {
  const query = new Set(terms(message));
  const matches: {
    source: Source;
    document: KnowledgeDocument;
    score: number;
  }[] = [];
  for (const document of getCurrentDocuments(documents, now, role)) {
    for (const section of document.sections) {
      if (
        !section.id.trim() ||
        !section.section.trim() ||
        !section.excerpt.trim()
      )
        continue;
      const matchingTerms = new Set<string>();
      for (const keyword of section.keywords) {
        const words = terms(keyword);
        if (words.length && words.every((word) => query.has(word)))
          words.forEach((word) => matchingTerms.add(word));
      }
      if (!matchingTerms.size) continue;
      matches.push({
        document,
        score: matchingTerms.size,
        source: {
          id: `${encodeURIComponent(document.documentId)}:${document.revision}:${encodeURIComponent(section.id)}`,
          title: document.title,
          version: document.version,
          section: section.section,
          excerpt: section.excerpt,
        },
      });
    }
  }
  const selected = matches
    .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id))
    .slice(0, 4);
  const usedDocuments = [
    ...new Map(
      selected.map(({ document }) => [document.documentId, document]),
    ).values(),
  ];
  return {
    sources: selected.map(({ source }) => source),
    mode: !selected.length
      ? "none"
      : usedDocuments.some((document) => document.sample)
        ? "sample"
        : "company",
    missing: !selected.length,
    documents: usedDocuments.map(
      ({
        documentId,
        revision,
        title,
        version,
        effectiveFrom,
        reviewBy,
        sample,
      }) => ({
        documentId,
        revision,
        title,
        version,
        effectiveFrom,
        reviewBy,
        sample,
      }),
    ),
  };
}
