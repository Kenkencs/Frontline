import type { EmployeeRole, Source } from "../../shared/chat";

export interface KnowledgeDocument {
  documentId: string;
  revision: number;
  title: string;
  version: string;
  status: "approved" | "draft" | "retired";
  effectiveFrom: string; // YYYY-MM-DD, UTC; becomes effective on this date.
  reviewBy: string; // YYYY-MM-DD; usable through this date, then requires review.
  roles: EmployeeRole[];
  sample: boolean;
  sections: {
    id: string;
    section: string;
    question?: string; // Optional FAQ prompt shown in the Knowledge Base.
    category?: string; // Small topic label for browsing; retrieval uses keywords.
    excerpt: string;
    keywords: string[];
  }[];
}

export type KnowledgeDocumentMetadata = Pick<
  KnowledgeDocument,
  | "documentId"
  | "revision"
  | "title"
  | "version"
  | "effectiveFrom"
  | "reviewBy"
  | "sample"
>;

export interface KnowledgeResult {
  sources: Source[];
  mode: "sample" | "company" | "none";
  missing: boolean;
  documents: KnowledgeDocumentMetadata[];
}
