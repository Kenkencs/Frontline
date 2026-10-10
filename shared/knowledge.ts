import type { Source } from "./chat";

export interface KnowledgePolicy {
  documentId: string;
  revision: number;
  title: string;
  version: string;
  effectiveFrom: string;
  reviewBy: string;
  sample: boolean;
  sections: Source[];
}

export interface KnowledgeCatalog {
  mode: "sample" | "company" | "none";
  documents: KnowledgePolicy[];
}
