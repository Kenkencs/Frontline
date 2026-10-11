import assert from "node:assert/strict";
import test from "node:test";
import { knowledgeDocuments } from "../server/knowledge/documents";
import {
  getCurrentDocuments,
  retrieveKnowledge,
} from "../server/knowledge/retrieve";
import type { KnowledgeDocument } from "../server/knowledge/types";

const now = new Date("2026-10-10T12:00:00Z");
function document(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    documentId: "policy",
    revision: 1,
    title: "Test SOP",
    version: "v1",
    status: "approved",
    effectiveFrom: "2026-01-01",
    reviewBy: "2027-12-31",
    roles: ["waiter"],
    sample: false,
    sections: [
      {
        id: "allergy",
        section: "§1",
        excerpt: "Check records and ask the manager.",
        keywords: ["peanut"],
      },
    ],
    ...overrides,
  };
}
const retrieve = (
  documents: KnowledgeDocument[],
  message = "PEANUT allergy?",
) => retrieveKnowledge(message, "waiter", documents, now);

test("sample allergy evidence is current, traceable, and never the retired revision", () => {
  const result = retrieve(knowledgeDocuments);
  assert.equal(result.mode, "sample");
  assert.equal(result.missing, false);
  assert.ok(
    result.sources.some((source) => source.id === "food-safety:3:allergy"),
  );
  assert.ok(
    result.sources.every((source) => !source.id.startsWith("food-safety:2:")),
  );
  assert.ok(
    result.sources.every(
      (source) =>
        source.title && source.version && source.section && source.excerpt,
    ),
  );
});
test("receipt-printer paraphrase retrieves the cashier FAQ without a payment keyword", () => {
  const question = "The receipt printer is not printing. What should I do?";
  const result = retrieveKnowledge(question, "cashier", knowledgeDocuments, now);
  assert.equal(result.missing, false);
  assert.equal(result.mode, "sample");
  const source = result.sources.find(item => item.id === "cashier-faq:1:missing-receipt");
  assert.ok(source);
  assert.match(source.excerpt, /transaction status/);
  assert.match(source.excerpt, /printer's paper/);
  assert.match(source.excerpt, /Reprint the receipt/);
  assert.ok(!retrieveKnowledge(question, "waiter", knowledgeDocuments, now).sources.some(item => item.id === source.id));
});
test("latest revision is chosen before matching keywords or staff roles", () => {
  const latest = document({
    revision: 2,
    version: "v2",
    sections: [
      {
        id: "new",
        section: "§2",
        excerpt: "New procedure",
        keywords: ["refund"],
      },
    ],
  });
  assert.equal(retrieve([document(), latest]).missing, true);
  assert.equal(
    retrieve([document(), document({ revision: 2, roles: ["cashier"] })])
      .missing,
    true,
  );
  assert.equal(getCurrentDocuments([latest], now).length, 1);
  assert.equal(getCurrentDocuments([latest], now, "cashier").length, 0);
});
test("latest retired or expired revisions suppress older approvals", () => {
  for (const changes of [
    { status: "retired" as const },
    { reviewBy: "2026-10-09" },
  ])
    assert.equal(
      retrieve([document(), document({ revision: 2, ...changes })]).missing,
      true,
    );
});
test("future and draft revisions do not supersede the effective approved version", () => {
  const result = retrieve([
    document(),
    document({ revision: 2, effectiveFrom: "2027-01-01" }),
    document({ revision: 3, status: "draft" }),
  ]);
  assert.equal(result.sources[0].id, "policy:1:allergy");
});
test("invalid policy dates, revisions, and ambiguous versions are rejected", () => {
  for (const changes of [
    { effectiveFrom: "2026-02-30" },
    { reviewBy: "invalid" },
    { revision: 1.5 },
    { revision: 0 },
  ])
    assert.equal(retrieve([document(changes)]).missing, true);
  assert.equal(retrieve([document(), document()]).missing, true);
  assert.equal(
    getCurrentDocuments([document()], new Date("invalid")).length,
    0,
  );
  assert.equal(retrieve([document({ reviewBy: "2026-10-10" })]).missing, false);
});
test("company mode requires every selected document to be real company evidence", () => {
  assert.equal(retrieve([document()]).mode, "company");
  assert.equal(
    retrieve([document(), document({ documentId: "sample", sample: true })])
      .mode,
    "sample",
  );
});
test("matching uses exact meaningful terms and returns at most four sources", () => {
  for (const message of [
    "peanutty",
    "Customer says please help me",
    "unrelated software issue",
  ])
    assert.deepEqual(retrieve([document()], message), {
      sources: [],
      mode: "none",
      missing: true,
      documents: [],
    });
  const result = retrieve(
    Array.from({ length: 6 }, (_, index) =>
      document({ documentId: `policy-${index}` }),
    ),
  );
  assert.equal(result.sources.length, 4);
  assert.equal(result.documents.length, 4);
});
