import assert from "node:assert/strict";
import { test } from "node:test";
import type { EmployeeRole } from "../shared/chat";
import type { FaqCatalog, QuestionRecord, ReviewAction } from "../shared/faq";
import {
  getFaq,
  getQuestions,
  reviewQuestion,
  submitQuestion,
} from "../src/services/faqClient";

const future = new Date();
future.setUTCDate(future.getUTCDate() + 30);
const reviewBy = future.toISOString().slice(0, 10);
const pending: QuestionRecord = {
  id: "question-1",
  question: "Where is the opening checklist?",
  employee_role: "waiter",
  status: "pending",
  answer: null,
  category: null,
  source_reference: null,
  created_at: "2026-10-10T12:00:00.000Z",
  published_at: null,
  review_by: null,
};
const publish: ReviewAction & { action: "publish" } = {
  action: "publish",
  answer: "Read the current checklist with your manager.",
  category: "Opening",
  source_reference: "Opening Checklist v1 §1.1",
  review_by: reviewBy,
};
const published: QuestionRecord = {
  ...pending,
  ...publish,
  status: "published",
  published_at: "2026-10-11T12:00:00.000Z",
};
const catalog: FaqCatalog = {
  mode: "sample",
  faqs: [
    {
      id: "faq-1",
      question: pending.question,
      answer: publish.answer,
      category: publish.category,
      source_reference: publish.source_reference,
      review_by: reviewBy,
      source: {
        id: "opening:1:checklist",
        title: "Opening Checklist",
        version: "v1",
        section: "§1.1",
        excerpt: "Read the checklist.",
        sample: true,
      },
    },
  ],
};

test("FAQ reads are same-origin, role-specific, and preserve exact source records", async (t) => {
  let expectedRole: EmployeeRole = "waiter";
  t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, `/api/faq?employee_role=${expectedRole}`);
      assert.equal(init?.body, undefined);
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return Response.json(catalog);
    },
  );
  for (const role of ["waiter", "cashier", "kitchen_staff"] as const) {
    expectedRole = role;
    assert.deepEqual(await getFaq(role), catalog);
  }
});

test("malformed FAQ records and missing sample labels are rejected before rendering", async (t) => {
  const item = catalog.faqs[0];
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json(catalog),
  );
  for (const value of [
    null,
    { faqs: [] },
    { ...catalog, mode: "unknown" },
    ...[
      { ...item, answer: " " },
      { ...item, question: null },
      { ...item, review_by: "2026-02-30" },
      { ...item, source: { ...item.source, excerpt: "" } },
      { ...item, source: { ...item.source, sample: undefined } },
    ].map((invalid) => ({ ...catalog, faqs: [invalid] })),
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json(value));
    await assert.rejects(getFaq("waiter"), /invalid FAQ|valid FAQ response/);
  }
});

test("question lists validate status and published-record invariants", async (t) => {
  let expectedStatus = "pending";
  let record = pending;
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL) => {
      assert.equal(url, `/api/questions?status=${expectedStatus}`);
      return Response.json({ questions: [record] });
    },
  );
  assert.deepEqual(await getQuestions("pending"), [pending]);
  expectedStatus = "published";
  record = published;
  assert.deepEqual(await getQuestions("published"), [published]);
  for (const value of [
    { questions: [pending] },
    { questions: [{ ...published, source_reference: null }] },
    { questions: null },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json(value));
    await assert.rejects(getQuestions("published"), /invalid question list/);
  }
});

test("submission trims and sends only the common fields, requiring a matching pending receipt", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, "/api/questions");
      assert.equal(init?.method, "POST");
      assert.equal(
        new Headers(init?.headers).get("content-type"),
        "application/json",
      );
      assert.deepEqual(JSON.parse(init?.body as string), {
        question: pending.question,
        employee_role: "waiter",
      });
      return Response.json({ question: pending }, { status: 201 });
    },
  );
  assert.deepEqual(
    await submitQuestion({
      question: ` ${pending.question} `,
      employee_role: "waiter",
    }),
    pending,
  );
  for (const value of [
    {},
    { question: published },
    { question: { ...pending, employee_role: "cashier" } },
    { question: { ...pending, question: "Different question" } },
  ]) {
    fetchMock.mock.mockImplementation(async () =>
      Response.json(value, { status: 201 }),
    );
    await assert.rejects(
      submitQuestion({ question: pending.question, employee_role: "waiter" }),
      /Could not confirm/,
    );
  }
});

test("empty and oversized questions fail validation without a network write", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ question: pending });
  });
  for (const question of [" ", "x".repeat(1001)])
    await assert.rejects(submitQuestion({ question, employee_role: "waiter" }));
  assert.equal(calls, 0);
});

test("review writes encode IDs and require matching publish/reject receipts", async (t) => {
  const id = "question / one";
  let expected: ReviewAction = publish;
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, `/api/questions/${encodeURIComponent(id)}`);
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(init?.body as string), expected);
      return Response.json({
        question:
          expected.action === "publish"
            ? { ...published, id }
            : { ...pending, id, status: "rejected" },
      });
    },
  );
  assert.equal((await reviewQuestion(id, publish)).status, "published");
  expected = { action: "reject" };
  assert.equal((await reviewQuestion(id, expected)).status, "rejected");
  for (const question of [
    { ...published, id: "other" },
    { ...published, id, answer: "Unexpected answer" },
    { ...pending, id },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json({ question }));
    await assert.rejects(reviewQuestion(id, publish), /Could not confirm/);
  }
});

test("publish requires source, category, answer, and future date before writing", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ question: published });
  });
  for (const field of ["answer", "category", "source_reference", "review_by"])
    await assert.rejects(
      reviewQuestion(pending.id, { ...publish, [field]: "" }),
    );
  assert.equal(calls, 0);
});

test("failed or non-JSON writes never report publication or invent a local receipt", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>error</html>", { status: 500 }),
  );
  const input = {
    question: pending.question,
    employee_role: "waiter" as const,
  };
  await assert.rejects(submitQuestion(input), /Could not confirm/);
  fetchMock.mock.mockImplementation(
    async () => new Response("not json", { status: 201 }),
  );
  await assert.rejects(submitQuestion(input), /Could not confirm/);
  fetchMock.mock.mockImplementation(async () => {
    throw new TypeError("offline");
  });
  await assert.rejects(
    reviewQuestion(pending.id, publish),
    /Could not confirm/,
  );
  fetchMock.mock.mockImplementation(async () =>
    Response.json({ error: "already done" }, { status: 409 }),
  );
  await assert.rejects(
    reviewQuestion(pending.id, { action: "reject" }),
    /already been reviewed/,
  );
});

test("bounded write timeout reports uncertain persistence rather than success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(
    globalThis,
    "fetch",
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const result = submitQuestion({
    question: pending.question,
    employee_role: "waiter",
  });
  t.mock.timers.tick(10_000);
  await assert.rejects(result, /Could not confirm/);
});
