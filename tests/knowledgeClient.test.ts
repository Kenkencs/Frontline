import assert from "node:assert/strict";
import { test } from "node:test";
import { getKnowledge } from "../src/services/knowledgeClient";
import type { EmployeeRole } from "../shared/chat";
import type { KnowledgeCatalog } from "../shared/knowledge";

const company: KnowledgeCatalog = {
  mode: "company",
  documents: [
    {
      documentId: "opening-policy",
      revision: 2,
      title: "Opening Shift Checklist",
      version: "v2",
      effectiveFrom: "2026-01-01",
      reviewBy: "2026-12-31",
      sample: false,
      sections: [
        {
          id: "opening-policy:2:handover",
          title: "Opening Shift Checklist",
          version: "v2",
          section: "1.1",
          excerpt: "Read the shift handover before opening.",
          sample: false,
        },
      ],
    },
  ],
};

test("knowledge client reads the same-origin catalog for the selected role and preserves backend source IDs", async (t) => {
  let expectedRole: EmployeeRole = "waiter";
  let expectedCatalog = company;
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      assert.equal(url, `/api/knowledge?employee_role=${expectedRole}`);
      assert.equal(init?.signal, controller.signal);
      assert.ok(!init?.method || init.method === "GET");
      assert.equal(init?.body, undefined);
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return Response.json(expectedCatalog);
    },
  );
  for (const role of ["waiter", "cashier", "kitchen_staff"] as const) {
    expectedRole = role;
    assert.deepEqual(await getKnowledge(role, controller.signal), company);
  }
  expectedCatalog = {
    mode: "sample",
    documents: company.documents.map((doc) => ({
      ...doc,
      sample: true,
      sections: doc.sections.map((source) => ({ ...source, sample: true })),
    })),
  };
  assert.deepEqual(
    await getKnowledge(expectedRole, controller.signal),
    expectedCatalog,
  );
  expectedCatalog = { mode: "none", documents: [] };
  assert.deepEqual(
    await getKnowledge(expectedRole, controller.signal),
    expectedCatalog,
  );
  assert.equal(calls, 5);
});

test("malformed catalog metadata and source records are rejected before rendering", async (t) => {
  const doc = company.documents[0];
  const source = doc.sections[0];
  const invalidCatalogs: unknown[] = [
    null,
    [],
    { ...company, mode: "unknown" },
    { ...company, documents: {} },
    { ...company, documents: [null] },
  ];
  for (const invalidDoc of [
    { ...doc, documentId: null },
    { ...doc, title: 1 },
    { ...doc, version: false },
    { ...doc, revision: 1.5 },
    { ...doc, revision: "2" },
    { ...doc, effectiveFrom: null },
    { ...doc, reviewBy: {} },
    { ...doc, sample: "company" },
    { ...doc, sections: null },
  ])
    invalidCatalogs.push({ ...company, documents: [invalidDoc] });
  for (const invalidSource of [
    null,
    { ...source, id: "" },
    { ...source, title: "   " },
    { ...source, version: 2 },
    { ...source, section: null },
    { ...source, excerpt: "" },
    { ...source, sample: "sample" },
  ])
    invalidCatalogs.push({
      ...company,
      documents: [{ ...doc, sections: [invalidSource] }],
    });
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json(company),
  );
  for (const value of invalidCatalogs) {
    fetchMock.mock.mockImplementation(async () => Response.json(value));
    await assert.rejects(
      getKnowledge("waiter", new AbortController().signal),
      /invalid knowledge catalog/,
    );
  }
});

test("failed requests reject instead of returning a local policy fallback", async (t) => {
  const privateDetail = "backend-private-diagnostic";
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: privateDetail }, { status: 500 }),
  );
  for (const status of [401, 404, 500]) {
    fetchMock.mock.mockImplementation(async () =>
      Response.json({ error: privateDetail }, { status }),
    );
    await assert.rejects(
      getKnowledge("cashier", new AbortController().signal),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Could not load the knowledge base/);
        assert.ok(!error.message.includes(privateDetail));
        return true;
      },
    );
  }
  fetchMock.mock.mockImplementation(
    async () => new Response("<html>Error</html>", { status: 502 }),
  );
  await assert.rejects(getKnowledge("cashier", new AbortController().signal));
  fetchMock.mock.mockImplementation(async () => {
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(
    getKnowledge("cashier", new AbortController().signal),
    TypeError,
  );
});

test("caller cancellation reaches the active fetch through the supplied AbortSignal", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      assert.equal(init?.signal, controller.signal);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        );
      });
    },
  );
  const pending = getKnowledge("kitchen_staff", controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof DOMException);
    assert.equal(error.name, "AbortError");
    return true;
  });
  assert.equal(calls, 1);
});
