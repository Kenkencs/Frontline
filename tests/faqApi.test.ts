import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "node:test";
import { handleApiRequest, type ApiOptions } from "../server/api";
import { createSqliteFaqStore } from "../server/faq/sqliteStore";
import type { FaqD1Database } from "../server/faq/store";
import worker from "../server/worker";
import type { EmployeeRole } from "../shared/chat";
import type { FaqCatalog, QuestionResult } from "../shared/faq";
import type { KnowledgeCatalog } from "../shared/knowledge";
import { parseChatResponse } from "../shared/validation";

// Real SQLite queries, fake workplace content, and no external requests.
const now = new Date("2026-10-11T12:00:00Z");
const migration = readFileSync(
  new URL("../drizzle/0000_military_wolfsbane.sql", import.meta.url),
  "utf8",
);
const question = "Where is the cobalt tray inventory record?";
const answer =
  "Read the tray inventory record at the prep desk and ask the manager if it is incomplete.";
const publication = {
  action: "publish",
  answer,
  category: "Stock records",
  source_reference: "Tray Register v1 §2",
  review_by: "2026-10-12",
};

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://frontline.example.test${path}`, {
    method,
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
}

function fixture(t: TestContext) {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  t.after(() => database.close());
  const options: ApiOptions = { faqStore: createSqliteFaqStore(database), now };
  return { database, options };
}

async function json<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json() as Promise<T>;
}

function chatRequest(role: EmployeeRole = "cashier"): Request {
  return request("/api/chat", "POST", {
    message: question,
    employee_role: role,
    provider: "openai",
    model: "demo-gpt",
  });
}

test("FAQ and knowledge APIs expose twelve sample FAQs for each selected role and validate read-only routes", async (t) => {
  const { options } = fixture(t);
  for (const role of ["cashier", "waiter", "kitchen_staff"] as const) {
    const faq = await json<FaqCatalog>(
      await handleApiRequest(
        request(`/api/faq?employee_role=${role}`),
        options,
      ),
    );
    assert.equal(faq.mode, "sample");
    assert.equal(faq.faqs.length, 12);
    assert.ok(
      faq.faqs.every(
        (item) =>
          item.id.startsWith(`${role}-faq:1:`) && item.source.sample === true,
      ),
    );
    const knowledge = await json<KnowledgeCatalog>(
      await handleApiRequest(
        request(`/api/knowledge?employee_role=${role}`),
        options,
      ),
    );
    const roleDocument = knowledge.documents.filter((doc) =>
      doc.documentId.endsWith("-faq"),
    );
    assert.equal(roleDocument.length, 1);
    assert.equal(roleDocument[0].documentId, `${role}-faq`);
    assert.equal(roleDocument[0].sections.length, 12);
    assert.ok(
      knowledge.documents.some((doc) => doc.documentId === "opening-checklist"),
    );
  }
  for (const path of [
    "/api/faq",
    "/api/faq?employee_role=unknown",
    "/api/knowledge?employee_role=unknown",
  ]) {
    await json(await handleApiRequest(request(path), options), 400);
  }
  for (const path of [
    "/api/faq?employee_role=cashier",
    "/api/knowledge?employee_role=waiter",
    "/api/workplace",
  ]) {
    const response = await handleApiRequest(request(path, "POST", {}), options);
    assert.equal(response.headers.get("allow"), "GET");
    await json(response, 405);
  }
});

test("a saved question stays pending until a complete review publishes role-only sample evidence, then expires", async (t) => {
  const { options } = fixture(t);
  const isolated: ApiOptions = {
    ...options,
    documents: [],
    fetchImpl: async () => {
      throw new Error("Demo integration tests must never call a paid model");
    },
  };
  const submitted = await json<QuestionResult>(
    await handleApiRequest(
      request("/api/questions", "POST", {
        question,
        employee_role: "cashier",
        status: "published",
        answer: "Client cannot publish this.",
      }),
      isolated,
    ),
    201,
  );
  const id = submitted.question.id;
  const sourceId = `faq-${id}:1:answer`;
  assert.equal(submitted.question.status, "pending");
  assert.equal(submitted.question.answer, null);
  const pending = await json<{ questions: { id: string }[] }>(
    await handleApiRequest(
      request("/api/questions?status=pending&employee_role=cashier"),
      isolated,
    ),
  );
  assert.deepEqual(
    pending.questions.map((item) => item.id),
    [id],
  );
  const before = await json<FaqCatalog>(
    await handleApiRequest(request("/api/faq?employee_role=cashier"), isolated),
  );
  assert.deepEqual(before.faqs, []);
  const beforeChat = parseChatResponse(
    await json(await handleApiRequest(chatRequest(), isolated)),
  );
  assert.deepEqual(beforeChat.sources, []);

  // Neither an empty reference nor an already-expired review date can promote a pending answer.
  for (const changes of [
    { source_reference: "" },
    { review_by: "2026-10-10" },
  ]) {
    await json(
      await handleApiRequest(
        request(`/api/questions/${id}`, "POST", { ...publication, ...changes }),
        isolated,
      ),
      400,
    );
    assert.equal(
      (await options.faqStore!.list("cashier", "pending"))[0].id,
      id,
    );
    assert.deepEqual(
      (
        await json<FaqCatalog>(
          await handleApiRequest(
            request("/api/faq?employee_role=cashier"),
            isolated,
          ),
        )
      ).faqs,
      [],
    );
  }

  const published = await json<QuestionResult>(
    await handleApiRequest(
      request(`/api/questions/${id}`, "POST", publication),
      isolated,
    ),
  );
  assert.equal(published.question.status, "published");
  assert.equal(published.question.published_at, now.toISOString());
  assert.equal(
    published.question.source_reference,
    publication.source_reference,
  );
  assert.deepEqual(await options.faqStore!.list("cashier", "pending"), []);
  const faq = await json<FaqCatalog>(
    await handleApiRequest(request("/api/faq?employee_role=cashier"), isolated),
  );
  assert.equal(faq.faqs.length, 1);
  assert.equal(faq.mode, "sample");
  assert.equal(faq.faqs[0].id, sourceId);
  assert.equal(faq.faqs[0].answer, answer);
  assert.equal(faq.faqs[0].source.sample, true);
  assert.match(
    faq.faqs[0].source.excerpt,
    /Manager-entered reference \(unverified\)/,
  );
  const knowledge = await json<KnowledgeCatalog>(
    await handleApiRequest(
      request("/api/knowledge?employee_role=cashier"),
      isolated,
    ),
  );
  assert.equal(knowledge.documents.length, 1);
  assert.equal(knowledge.documents[0].sections[0].id, sourceId);
  for (const role of ["waiter", "kitchen_staff"] as const) {
    assert.deepEqual(
      (
        await json<FaqCatalog>(
          await handleApiRequest(
            request(`/api/faq?employee_role=${role}`),
            isolated,
          ),
        )
      ).faqs,
      [],
    );
    assert.deepEqual(
      (
        await json<KnowledgeCatalog>(
          await handleApiRequest(
            request(`/api/knowledge?employee_role=${role}`),
            isolated,
          ),
        )
      ).documents,
      [],
    );
    assert.deepEqual(
      parseChatResponse(
        await json(await handleApiRequest(chatRequest(role), isolated)),
      ).sources,
      [],
    );
  }

  const reply = parseChatResponse(
    await json(await handleApiRequest(chatRequest(), isolated)),
  );
  assert.ok(reply.type === "message");
  assert.ok(reply.content.includes(answer));
  assert.match(reply.content, /fictional samples/);
  assert.deepEqual(
    reply.sources.map((source) => source.id),
    [sourceId],
  );
  assert.equal(reply.sources[0].sample, true);

  const expired = { ...isolated, now: new Date("2026-10-13T00:00:00Z") };
  assert.deepEqual(
    (
      await json<FaqCatalog>(
        await handleApiRequest(
          request("/api/faq?employee_role=cashier"),
          expired,
        ),
      )
    ).faqs,
    [],
  );
  assert.deepEqual(
    (
      await json<KnowledgeCatalog>(
        await handleApiRequest(
          request("/api/knowledge?employee_role=cashier"),
          expired,
        ),
      )
    ).documents,
    [],
  );
  assert.deepEqual(
    parseChatResponse(
      await json(await handleApiRequest(chatRequest(), expired)),
    ).sources,
    [],
  );
});

test("reviewed FAQ records survive closing and reopening a local SQLite database", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "frontline-faq-test-"));
  let database: DatabaseSync | undefined;
  t.after(() => {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const path = join(directory, "faq.sqlite");
  database = new DatabaseSync(path);
  database.exec(migration);
  let options: ApiOptions = {
    faqStore: createSqliteFaqStore(database),
    documents: [],
    now,
  };
  const submitted = await json<QuestionResult>(
    await handleApiRequest(
      request("/api/questions", "POST", { question, employee_role: "cashier" }),
      options,
    ),
    201,
  );
  await json(
    await handleApiRequest(
      request(`/api/questions/${submitted.question.id}`, "POST", publication),
      options,
    ),
  );
  database.close();
  database = undefined;
  database = new DatabaseSync(path);
  options = { ...options, faqStore: createSqliteFaqStore(database) };
  const faq = await json<FaqCatalog>(
    await handleApiRequest(request("/api/faq?employee_role=cashier"), options),
  );
  assert.equal(faq.faqs[0].id, `faq-${submitted.question.id}:1:answer`);
  assert.equal(faq.faqs[0].answer, answer);
  const reply = parseChatResponse(
    await json(await handleApiRequest(chatRequest(), options)),
  );
  assert.deepEqual(
    reply.sources.map((source) => source.id),
    [faq.faqs[0].id],
  );
});

test("Worker DB binding uses the D1 adapter and returns persisted published FAQs", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const { database } = fixture(t);
  const d1: FaqD1Database = {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        bind(...values) {
          return {
            async all<T = unknown>() {
              return {
                success: true,
                results: statement.all(...values) as T[],
              };
            },
            async run() {
              return {
                success: true,
                meta: { changes: Number(statement.run(...values).changes) },
              };
            },
          };
        },
      };
    },
  };
  let assets = 0;
  const env = {
    DB: d1,
    ASSETS: {
      fetch: async () => {
        assets += 1;
        return new Response("assets");
      },
    },
  };
  const submitted = await json<QuestionResult>(
    await worker.fetch(
      request("/api/questions", "POST", { question, employee_role: "cashier" }),
      env,
    ),
    201,
  );
  await json(
    await worker.fetch(
      request(`/api/questions/${submitted.question.id}`, "POST", publication),
      env,
    ),
  );
  const faq = await json<FaqCatalog>(
    await worker.fetch(request("/api/faq?employee_role=cashier"), env),
  );
  assert.ok(
    faq.faqs.some(
      (item) =>
        item.id === `faq-${submitted.question.id}:1:answer` &&
        item.answer === answer,
    ),
  );
  assert.equal(assets, 0);
});

test("workplace API exposes only public demo contact details and no active links", async () => {
  const contact = await json<Record<string, unknown>>(
    await handleApiRequest(request("/api/workplace"), {
      now,
      apiKeys: { openai: "fake-private-backend-key" },
    }),
  );
  assert.equal(contact.phone, "123456");
  assert.equal(contact.demo, true);
  assert.equal(contact.phoneHref, null);
  assert.equal(contact.contactHref, null);
  assert.ok(!JSON.stringify(contact).includes("fake-private-backend-key"));
});
