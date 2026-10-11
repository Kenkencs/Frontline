import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import {
  isQuestionRecord,
  parseReviewAction,
  type PublishQuestion,
} from "../shared/faq";
import { assessRisk } from "../server/agents/riskAgent";
import {
  getFaqCatalog,
  getPublishedFaqDocuments,
} from "../server/faq/knowledge";
import { handleQuestionRequest } from "../server/faq/questions";
import { createSqliteFaqStore } from "../server/faq/sqliteStore";
import {
  createD1FaqStore,
  FaqStoreError,
  type FaqD1Database,
  type FaqStore,
} from "../server/faq/store";
import { retrieveKnowledge } from "../server/knowledge/retrieve";
import type { KnowledgeDocument } from "../server/knowledge/types";

const now = new Date("2026-10-11T12:00:00Z");
const publish: PublishQuestion = {
  answer:
    "Do not confirm the cake is safe. Check the exact product records and ask the manager.",
  category: "Allergens",
  source_reference: "Manager's sample guide §2",
  review_by: "2027-01-01",
};
function setup(t: TestContext) {
  const database = new DatabaseSync(":memory:");
  database.exec(
    readFileSync(
      new URL("../drizzle/0000_military_wolfsbane.sql", import.meta.url),
      "utf8",
    ),
  );
  t.after(() => database.close());
  return { database, store: createSqliteFaqStore(database) };
}
function request(
  path = "/api/questions",
  value?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return new Request(
    `https://test.local${path}`,
    value === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", ...extraHeaders },
          body: JSON.stringify(value),
        },
  );
}
async function submit(
  store: FaqStore,
  question = "Can a customer with a peanut allergy eat this cake?",
) {
  return store.submit({ question, employee_role: "waiter" }, now);
}

test("actual migration and prepared SQLite statements persist a pending submission", async (t) => {
  const { database, store } = setup(t);
  const text = "Where is the manager's guide? '); DROP TABLE faq_questions; --";
  const response = await handleQuestionRequest(
    request(undefined, {
      question: `  ${text}  `,
      employee_role: "waiter",
      id: "client-id",
      status: "published",
      answer: "Injected",
    }),
    store,
    now,
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const saved = (await response.json()).question;
  assert.ok(isQuestionRecord(saved));
  assert.notEqual(saved.id, "client-id");
  assert.equal(saved.question, text);
  assert.equal(saved.status, "pending");
  assert.equal(saved.answer, null);
  assert.equal(saved.created_at, now.toISOString());
  // A second adapter sees the same persisted row; no in-memory fake storage.
  assert.deepEqual(
    await createSqliteFaqStore(database).list("waiter", "pending"),
    [saved],
  );
  assert.deepEqual(await store.list("cashier", "pending"), []);
});

test("reviewed answers become role-specific, canonical sample FAQ knowledge", async (t) => {
  const { store } = setup(t);
  const pending = await submit(store);
  assert.deepEqual(await getPublishedFaqDocuments(store, now), []);
  const response = await handleQuestionRequest(
    request(`/api/questions/${pending.id}`, { action: "publish", ...publish }),
    store,
    now,
  );
  assert.equal(response.status, 200);
  const saved = (await response.json()).question;
  assert.ok(isQuestionRecord(saved));
  assert.equal(saved.status, "published");
  assert.equal(saved.published_at, now.toISOString());
  const documents = await getPublishedFaqDocuments(store, now);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].sample, true);
  assert.equal(documents[0].title, "Reviewed FAQ");
  const catalog = getFaqCatalog(documents, "waiter", now);
  assert.equal(catalog.mode, "sample");
  assert.equal(catalog.faqs[0].question, pending.question);
  assert.equal(catalog.faqs[0].answer, publish.answer);
  assert.equal(catalog.faqs[0].source_reference, publish.source_reference);
  assert.equal(catalog.faqs[0].review_by, publish.review_by);
  const evidence = retrieveKnowledge(
    "peanut allergy",
    "waiter",
    documents,
    now,
  );
  assert.equal(evidence.mode, "sample");
  assert.equal(evidence.sources[0].id, catalog.faqs[0].source.id);
  assert.equal(evidence.sources[0].excerpt, catalog.faqs[0].source.excerpt);
  assert.match(evidence.sources[0].excerpt, /unverified/);
  assert.equal(assessRisk("peanut allergy", evidence).confidence, "low");
  assert.deepEqual(getFaqCatalog(documents, "cashier", now), {
    faqs: [],
    mode: "none",
  });
});

test("expiry and future effective dates keep published FAQs out of retrieval", async (t) => {
  const { store } = setup(t);
  const pending = await submit(store);
  await store.publish(pending.id, publish, now);
  assert.deepEqual(
    await getPublishedFaqDocuments(store, new Date("2027-01-02T00:00:00Z")),
    [],
  );
  assert.equal(
    (await getPublishedFaqDocuments(store, new Date("2027-01-01T23:59:59Z")))
      .length,
    1,
  );
  assert.deepEqual(
    await getPublishedFaqDocuments(store, new Date("2026-10-10T00:00:00Z")),
    [],
  );
});

test("FAQ browsing only exposes explicitly tagged questions while SOPs remain retrievable", () => {
  const document: KnowledgeDocument = {
    documentId: "opening",
    revision: 1,
    title: "Opening SOP",
    version: "v1",
    status: "approved",
    effectiveFrom: "2026-01-01",
    reviewBy: "2027-12-31",
    roles: ["cashier"],
    sample: true,
    sections: [
      {
        id: "procedure",
        section: "§1",
        excerpt: "Read the opening handover.",
        keywords: ["handover"],
      },
      {
        id: "faq",
        section: "§2",
        question: "Where is the opening checklist?",
        category: "Opening",
        excerpt: "Ask the shift manager for the checklist.",
        keywords: ["checklist"],
      },
    ],
  };
  const catalog = getFaqCatalog([document], "cashier", now);
  assert.equal(catalog.faqs.length, 1);
  assert.equal(catalog.faqs[0].question, document.sections[1].question);
  assert.equal(
    retrieveKnowledge("handover", "cashier", [document], now).sources.length,
    1,
  );
});

test("conditional review updates prevent concurrent decisions and publication replay", async (t) => {
  const { store } = setup(t);
  const pending = await submit(store);
  const results = await Promise.allSettled([
    store.publish(pending.id, publish, now),
    store.reject(pending.id),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failed = results.find((result) => result.status === "rejected");
  assert.ok(failed && failed.status === "rejected");
  assert.ok(failed.reason instanceof FaqStoreError);
  assert.equal(failed.reason.status, 409);
  const saved = (await store.list())[0];
  assert.equal(saved.status, "published");
  assert.equal(saved.answer, publish.answer);
  const repeated = await handleQuestionRequest(
    request(`/api/questions/${pending.id}`, {
      action: "publish",
      ...publish,
      answer: "Overwrite",
    }),
    store,
    now,
  );
  assert.equal(repeated.status, 409);
  assert.equal((await store.list())[0].answer, publish.answer);
  const absent = await handleQuestionRequest(
    request("/api/questions/unknown", { action: "reject" }),
    store,
    now,
  );
  assert.equal(absent.status, 404);
});

test("rejected questions remain reviewed and cannot be published later", async (t) => {
  const { store } = setup(t);
  const pending = await submit(store);
  const response = await handleQuestionRequest(
    request(`/api/questions/${pending.id}`, {
      action: "reject",
      answer: "Ignored",
    }),
    store,
    now,
  );
  assert.equal(response.status, 200);
  const saved = (await response.json()).question;
  assert.equal(saved.status, "rejected");
  assert.equal(saved.answer, null);
  assert.equal(saved.published_at, null);
  assert.deepEqual(await getPublishedFaqDocuments(store, now), []);
  await assert.rejects(
    store.publish(pending.id, publish, now),
    (error) => error instanceof FaqStoreError && error.status === 409,
  );
});

test("submission validation rejects malformed roles, empty questions, and character overflow", async (t) => {
  const { store } = setup(t);
  for (const value of [
    null,
    [],
    {},
    { question: "   ", employee_role: "waiter" },
    { question: "Question", employee_role: "manager" },
    { question: "q".repeat(1001), employee_role: "waiter" },
  ]) {
    const response = await handleQuestionRequest(
      request(undefined, value),
      store,
      now,
    );
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await store.list(), []);
});

test("publication validates answer/reference bounds and strict future UTC review dates", async (t) => {
  const { store } = setup(t);
  const pending = await submit(store);
  for (const changes of [
    { answer: " " },
    { answer: "a".repeat(4001) },
    { category: "c".repeat(61) },
    { source_reference: "s".repeat(201) },
    { source_reference: null },
    { review_by: "2026-10-11" },
    { review_by: "2026-10-10" },
    { review_by: "2027-02-30" },
    { review_by: "2027-10-12" },
    { review_by: "2027-01-01T00:00:00Z" },
    { review_by: "2027-1-01" },
    { action: "approve" },
  ]) {
    const response = await handleQuestionRequest(
      request(`/api/questions/${pending.id}`, {
        action: "publish",
        ...publish,
        ...changes,
      }),
      store,
      now,
    );
    assert.equal(response.status, 400, JSON.stringify(changes));
  }
  assert.equal((await store.list())[0].status, "pending");
  const valid = parseReviewAction(
    { action: "publish", ...publish, review_by: "2027-10-11" },
    now,
  );
  assert.equal(valid.action, "publish");
});

test("write requests require same origin when present, JSON, and a bounded byte body", async (t) => {
  const { store } = setup(t);
  const input = {
    question: "Where is the checklist?",
    employee_role: "waiter",
  };
  assert.equal(
    (
      await handleQuestionRequest(
        request(undefined, input, { Origin: "https://other.local" }),
        store,
        now,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleQuestionRequest(
        request(undefined, input, { Origin: "null" }),
        store,
        now,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleQuestionRequest(
        request(undefined, input, { "Content-Type": "text/plain" }),
        store,
        now,
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await handleQuestionRequest(
        request(undefined, input, { "Content-Length": "32769" }),
        store,
        now,
      )
    ).status,
    413,
  );
  const large = new TextEncoder().encode(
    JSON.stringify({ ...input, extra: "花".repeat(11000) }),
  );
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(large.slice(0, 1000));
      controller.enqueue(large.slice(1000));
      controller.close();
    },
  });
  const streamed = new Request("https://test.local/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.equal((await handleQuestionRequest(streamed, store, now)).status, 413);
  const malformed = new Request("https://test.local/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(
    (await handleQuestionRequest(malformed, store, now)).status,
    400,
  );
  assert.equal(
    (
      await handleQuestionRequest(
        request(undefined, input, { Origin: "https://test.local" }),
        store,
        now,
      )
    ).status,
    201,
  );
});

test("GET filters are validated, review queue defaults to pending, and writes are explicit", async (t) => {
  const { store } = setup(t);
  const published = await submit(store);
  await store.publish(published.id, publish, now);
  const pending = await store.submit(
    { question: "Where is the opening checklist?", employee_role: "cashier" },
    now,
  );
  const queue = await handleQuestionRequest(request(), store, now);
  assert.deepEqual((await queue.json()).questions, [pending]);
  const catalog = await handleQuestionRequest(
    request("/api/questions?status=published&employee_role=waiter"),
    store,
    now,
  );
  assert.equal((await catalog.json()).questions[0].id, published.id);
  for (const path of [
    "/api/questions?status=unknown",
    "/api/questions?employee_role=manager",
    "/api/questions?employee_role=",
  ])
    assert.equal(
      (await handleQuestionRequest(request(path), store, now)).status,
      400,
    );
  const method = await handleQuestionRequest(
    new Request("https://test.local/api/questions", { method: "DELETE" }),
    store,
    now,
  );
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, POST");
  assert.equal(
    (await handleQuestionRequest(request("/api/questions/some-id"), store, now))
      .status,
    405,
  );
  assert.equal(
    (await handleQuestionRequest(request("/api/other"), store, now)).status,
    404,
  );
});

test("list cap applies after status filtering and keeps oldest unanswered questions", async (t) => {
  const { store } = setup(t);
  const published = await submit(store);
  await store.publish(published.id, publish, now);
  for (let index = 0; index < 501; index++)
    await store.submit(
      { question: `Question ${index}`, employee_role: "waiter" },
      new Date(now.getTime() + index * 1000),
    );
  const pending = await store.list(undefined, "pending");
  assert.equal(pending.length, 500);
  assert.equal(pending[0].question, "Question 0");
  assert.equal(pending[499].question, "Question 499");
  assert.equal((await getPublishedFaqDocuments(store, now)).length, 1);
});

test("D1 structural adapter uses the same prepared SQL and never creates a table", async (t) => {
  const { database } = setup(t);
  const sql: string[] = [];
  const d1: FaqD1Database = {
    prepare(query) {
      sql.push(query);
      return {
        bind(...values) {
          return {
            async all<T>() {
              return {
                success: true,
                results: database.prepare(query).all(...values) as T[],
              };
            },
            async run() {
              return {
                success: true,
                meta: {
                  changes: Number(
                    database.prepare(query).run(...values).changes,
                  ),
                },
              };
            },
          };
        },
      };
    },
  };
  const store = createD1FaqStore(d1);
  const pending = await submit(store);
  await store.publish(pending.id, publish, now);
  assert.equal(
    (await store.list("waiter", "published"))[0].answer,
    publish.answer,
  );
  assert.ok(sql.every((query) => !/CREATE|ALTER|DROP/.test(query)));
  assert.ok(
    sql.some((query) => /WHERE id = \? AND status = 'pending'/.test(query)),
  );
});

test("missing bindings and database errors produce truthful sanitized 503 responses", async (t) => {
  const { store } = setup(t);
  const input = { question: "Question", employee_role: "waiter" };
  for (const operation of [request(), request(undefined, input)]) {
    const response = await handleQuestionRequest(operation, undefined, now);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /storage.*unavailable/);
  }
  const failed: FaqStore = {
    ...store,
    async list() {
      throw new Error("SQL connection secret details");
    },
    async submit() {
      throw new Error("SQL connection secret details");
    },
    publish: store.publish.bind(store),
    reject: store.reject.bind(store),
  };
  for (const operation of [request(), request(undefined, input)]) {
    const response = await handleQuestionRequest(operation, failed, now);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /secret|connection|SQL/);
  }
  const unavailableD1 = createD1FaqStore({
    prepare() {
      return {
        bind() {
          return {
            async all() {
              return { success: false };
            },
            async run() {
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
  });
  await assert.rejects(
    unavailableD1.list(),
    (error) => error instanceof FaqStoreError && error.status === 503,
  );
  await assert.rejects(
    submit(unavailableD1),
    (error) => error instanceof FaqStoreError && error.status === 503,
  );
  await assert.rejects(
    getPublishedFaqDocuments(),
    (error) => error instanceof FaqStoreError && error.status === 503,
  );
});
