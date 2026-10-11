import type { EmployeeRole, Source } from "../../shared/chat";
import type { FaqCatalog } from "../../shared/faq";
import { getCurrentDocuments } from "../knowledge/retrieve";
import type { KnowledgeDocument } from "../knowledge/types";
import { unavailableStore, type FaqStore } from "./store";

type FaqSection = KnowledgeDocument["sections"][number] & {
  question?: string;
  answer?: string;
  category?: string;
  source_reference?: string;
};
type FaqDocument = Omit<KnowledgeDocument, "sections"> & {
  sections: FaqSection[];
};
const stopWords = new Set(
  "a an the and or but to of for in on at is it this that can could should what how do does i me my we our you your he she they has have with says said please help need customer customers worker employee manager".split(
    " ",
  ),
);

function keywords(question: string): string[] {
  return [
    ...new Set(
      question
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ]
    .filter((word) => !stopWords.has(word))
    .slice(0, 40);
}

export async function getPublishedFaqDocuments(
  store?: FaqStore,
  now = new Date(),
): Promise<KnowledgeDocument[]> {
  if (!store) throw unavailableStore();
  const questions = await store.list(undefined, "published");
  const documents: FaqDocument[] = questions.map((question) => ({
    documentId: `faq-${question.id}`,
    revision: 1,
    title: "Reviewed FAQ",
    version: "v1",
    status: "approved",
    effectiveFrom: question.published_at!.slice(0, 10),
    reviewBy: question.review_by!,
    roles: [question.employee_role],
    // A manager-entered answer in this fictional prototype is still sample knowledge.
    sample: true,
    sections: [
      {
        id: "answer",
        section: `FAQ · ${question.category}`,
        excerpt: `${question.answer}\n\nManager-entered reference (unverified): ${question.source_reference}`,
        keywords: keywords(question.question),
        question: question.question,
        answer: question.answer!,
        category: question.category!,
        source_reference: question.source_reference!,
      },
    ],
  }));
  // Reuse policy expiry and effective-date rules; expired FAQs cannot re-enter RAG.
  return getCurrentDocuments(documents, now);
}

export function getFaqCatalog(
  documents: KnowledgeDocument[],
  role: EmployeeRole,
  now = new Date(),
): FaqCatalog {
  const current = getCurrentDocuments(documents, now, role) as FaqDocument[];
  const faqs = current
    .flatMap((document) =>
      document.sections
        .filter(
          (section) =>
            section.question?.trim() &&
            section.id.trim() &&
            section.section.trim() &&
            section.excerpt.trim(),
        )
        .map((section) => {
          const source: Source = {
            id: `${encodeURIComponent(document.documentId)}:${document.revision}:${encodeURIComponent(section.id)}`,
            title: document.title,
            version: document.version,
            section: section.section,
            excerpt: section.excerpt,
            sample: document.sample,
          };
          return {
            id: source.id,
            question: section.question!,
            answer: section.answer ?? section.excerpt,
            category: section.category ?? document.title,
            source_reference:
              section.source_reference ??
              `${document.title} ${document.version} ${section.section}`,
            review_by: document.reviewBy,
            source,
          };
        }),
    )
    .slice(0, 500);
  return {
    faqs,
    mode: !faqs.length
      ? "none"
      : faqs.some((faq) => faq.source.sample !== false)
        ? "sample"
        : "company",
  };
}
