import assert from "node:assert/strict";
import { test } from "node:test";
import { knowledgeDocuments } from "../server/knowledge/documents";
import { roleDocuments } from "../server/knowledge/roleDocuments";
import {
  getCurrentDocuments,
  retrieveKnowledge,
} from "../server/knowledge/retrieve";
import type { EmployeeRole } from "../shared/chat";
import type { KnowledgeDocument } from "../server/knowledge/types";

const now = new Date("2026-10-11T12:00:00Z");
const roles: EmployeeRole[] = ["cashier", "waiter", "kitchen_staff"];

test("each role has twelve distinct, labelled fictional FAQs", () => {
  assert.equal(roleDocuments.length, roles.length);
  for (const role of roles) {
    const document = roleDocuments.find((item) => item.roles.includes(role));
    assert.ok(document);
    assert.deepEqual(document.roles, [role]);
    assert.equal(document.sample, true);
    assert.equal(document.status, "approved");
    assert.equal(document.sections.length, 12);
    assert.equal(
      new Set(document.sections.map((section) => section.id)).size,
      12,
    );
    assert.equal(
      new Set(document.sections.map((section) => section.question)).size,
      12,
    );
    for (const section of document.sections) {
      assert.ok(section.question?.trim());
      assert.ok(section.category?.trim());
      assert.ok(section.excerpt.trim());
      assert.ok(section.keywords.length > 0);
    }
  }
});

test("current catalog combines common SOPs with only the selected role's FAQs", () => {
  for (const role of roles) {
    const current = getCurrentDocuments(knowledgeDocuments, now, role);
    assert.ok(
      current.some((document) => document.documentId === "opening-checklist"),
    );
    assert.ok(
      current.some(
        (document) =>
          document.documentId === "food-safety" && document.revision === 3,
      ),
    );
    assert.deepEqual(
      current
        .filter((document) => document.documentId.endsWith("-faq"))
        .map((document) => document.documentId),
      [`${role}-faq`],
    );
  }
});

test("every FAQ question retrieves its own current source for its role", () => {
  for (const document of roleDocuments) {
    const role = document.roles[0];
    for (const section of document.sections) {
      assert.ok(section.question);
      const result = retrieveKnowledge(
        section.question,
        role,
        knowledgeDocuments,
        now,
      );
      const expectedId = `${document.documentId}:${document.revision}:${section.id}`;
      assert.ok(
        result.sources.some((source) => source.id === expectedId),
        `${role}: ${section.question}`,
      );
      assert.equal(result.mode, "sample");
      assert.equal(result.missing, false);
    }
  }
});

test("role-only FAQ documents do not leak into another role's retrieval", () => {
  for (const document of roleDocuments) {
    for (const otherRole of roles.filter(
      (role) => !document.roles.includes(role),
    )) {
      for (const section of document.sections) {
        assert.ok(section.question);
        const result = retrieveKnowledge(
          section.question,
          otherRole,
          [document],
          now,
        );
        assert.deepEqual(result.sources, []);
        assert.equal(result.missing, true);
      }
    }
  }
});

test("FAQ revision filtering never resurrects stale role-specific instructions", () => {
  const first = roleDocuments[0];
  const role = first.roles[0];
  const question = first.sections[0].question;
  assert.ok(question);
  const newer = (changes: Partial<KnowledgeDocument>): KnowledgeDocument => ({
    ...first,
    revision: 2,
    version: "v2",
    ...changes,
  });
  for (const changes of [
    { status: "retired" as const },
    { reviewBy: "2026-10-10" },
    { roles: ["waiter"] as EmployeeRole[] },
  ]) {
    assert.equal(
      retrieveKnowledge(question, role, [first, newer(changes)], now).missing,
      true,
    );
  }
  for (const changes of [
    { status: "draft" as const },
    { effectiveFrom: "2027-01-01" },
  ]) {
    const result = retrieveKnowledge(
      question,
      role,
      [first, newer(changes)],
      now,
    );
    assert.ok(
      result.sources.some(
        (source) =>
          source.id === `${first.documentId}:1:${first.sections[0].id}`,
      ),
    );
  }
});
