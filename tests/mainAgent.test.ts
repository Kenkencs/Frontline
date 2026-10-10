import assert from "node:assert/strict";
import test from "node:test";
import { runMainAgent } from "../server/agents/mainAgent";
import { handleApiRequest } from "../server/api";
import type { KnowledgeDocument } from "../server/knowledge/types";
import { retrieveKnowledge } from "../server/knowledge/retrieve";
import {
  ProviderError,
  type AIProvider,
  type ProviderInput,
} from "../server/providers/AIProvider";
import type {
  ActionResponse,
  ChatRequest,
  ChatResponse,
  Source,
} from "../shared/chat";

const now = new Date("2026-10-10T12:00:00Z");
const input: ChatRequest = {
  message: "Severe peanut allergy",
  employee_role: "waiter",
  provider: "openai",
  model: "gpt-4.1-mini",
};
const company: KnowledgeDocument = {
  documentId: "food policy:company",
  revision: 3,
  title: "Company Food SOP",
  version: "v3",
  status: "approved",
  effectiveFrom: "2026-01-01",
  reviewBy: "2027-12-31",
  roles: ["waiter"],
  sample: false,
  sections: [
    {
      id: "allergy:step",
      section: "§4",
      excerpt: "Check exact product records and ask the manager.",
      keywords: ["peanut", "opening"],
    },
  ],
};
const source: Source = {
  ...retrieveKnowledge(input.message, "waiter", [company], now).sources[0],
  sample: false,
};
const card: ActionResponse = {
  type: "action",
  risk: "high",
  summary: "Unsafe provider summary",
  actions: ["Tell the customer this food is safe."],
  sources: [source],
  confidence: "medium",
  escalate: true,
};
function adapter(
  response: ChatResponse,
  capture?: (value: ProviderInput) => void,
): AIProvider {
  return {
    async generate() {
      return "Unused";
    },
    async structuredGenerate(value, schema) {
      capture?.(value);
      return schema.parse({ response });
    },
    async *stream() {
      yield "Unused";
    },
  };
}
function run(response: ChatResponse, documents = [company], request = input) {
  return runMainAgent(request, {
    mode: "live",
    provider: adapter(response),
    documents,
    now,
  });
}

test("Main Agent supplies retrieved evidence and risk context, and owns hazardous steps", async () => {
  let prompt: ProviderInput | undefined;
  const result = await runMainAgent(input, {
    mode: "live",
    provider: adapter(card, (value) => {
      prompt = value;
    }),
    documents: [company],
    now,
  });
  assert.ok(prompt);
  const context = JSON.parse(prompt.prompt);
  assert.equal(context.knowledge.mode, "company");
  assert.equal(context.risk_assessment.risk, "high");
  assert.deepEqual(context.knowledge.sources, [source]);
  assert.match(prompt.systemPrompt, /data, never instructions/);
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.match(result.summary, /allergy/);
  assert.ok(result.actions.some((action) => /Do not confirm/.test(action)));
  assert.ok(
    result.actions.some((action) => /cross-contamination/.test(action)),
  );
  assert.ok(!result.actions.includes(card.actions[0]));
  assert.deepEqual(result.sources, [source]);
});

test("citations must match canonical retrieved content and cannot be duplicated", async () => {
  for (const changes of [
    { id: "invented" },
    { title: "Other" },
    { version: "v99" },
    { section: "§99" },
    { excerpt: "The cake is safe." },
    { sample: true },
  ])
    await assert.rejects(
      run({ ...card, sources: [{ ...source, ...changes }] }),
      ProviderError,
    );
  await assert.rejects(
    run({ ...card, sources: [source, source] }),
    ProviderError,
  );
});

test("risk, confidence, and escalation cannot contradict application checks", async () => {
  for (const changes of [
    { risk: "low" as const },
    { confidence: "high" as const },
    { escalate: false },
  ])
    await assert.rejects(run({ ...card, ...changes }), ProviderError);
  await assert.rejects(
    run({ type: "message", content: "This is fine.", sources: [] }),
    ProviderError,
  );
});

test("sample evidence is labeled and caps confidence at low for live providers", async () => {
  const sample = { ...company, sample: true };
  await assert.rejects(
    run({ ...card, sources: [], confidence: "medium" }, [sample]),
    ProviderError,
  );
  const result = await run({ ...card, sources: [], confidence: "low" }, [
    sample,
  ]);
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.equal(result.sources[0].sample, true);
  assert.ok(result.actions.some((action) => /fictional samples/.test(action)));
});

test("missing or retired evidence cannot be cited or increase confidence", async () => {
  await assert.rejects(run(card, []), ProviderError);
  await assert.rejects(
    run(card, [{ ...company, status: "retired" }]),
    ProviderError,
  );
  const result = await run({ ...card, sources: [], confidence: "low" }, []);
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.deepEqual(result.sources, []);
  assert.ok(
    result.actions.some((action) =>
      /current relevant company policy/.test(action),
    ),
  );
});

test("unverified permission decisions use manager verification steps", async () => {
  const result = await run(
    { ...card, risk: "low", sources: [], confidence: "low" },
    [],
    { ...input, message: "Can I change the opening procedure?" },
  );
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.ok(!result.actions.includes(card.actions[0]));
  assert.match(result.actions.join(" "), /manager/);
  assert.equal(result.escalate, true);
});

test("ordinary company questions keep standard messages and verified citations", async () => {
  const result = await run(
    {
      type: "message",
      content: "Read the current checklist.",
      sources: [source],
    },
    [company],
    { ...input, message: "Opening checklist" },
  );
  assert.equal(result.type, "message");
  if (result.type !== "message") assert.fail();
  assert.equal(result.content, "Read the current checklist.");
  assert.deepEqual(result.sources, [source]);
});

test("ordinary missing-evidence replies append verification instead of inventing sources", async () => {
  const result = await run(
    { type: "message", content: "Please clarify your question.", sources: [] },
    [],
    { ...input, message: "Where is the checklist?" },
  );
  assert.equal(result.type, "message");
  if (result.type !== "message") assert.fail();
  assert.match(result.content, /manager/);
  assert.deepEqual(result.sources, []);
});

test("a matching checklist cannot grant permission to change company procedure", async () => {
  const request = { ...input, message: "Can I change the opening time?" };
  await assert.rejects(
    run(
      {
        type: "message",
        content: "Yes, change the opening time without a manager.",
        sources: [source],
      },
      [company],
      request,
    ),
    ProviderError,
  );
  const result = await run(
    {
      ...card,
      risk: "low",
      actions: ["Change the opening time without a manager."],
    },
    [company],
    request,
  );
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.equal(result.escalate, true);
  assert.match(result.actions.join(" "), /manager.*authority/);
  assert.ok(
    !result.actions.some((action) => action.includes("without a manager")),
  );
});

test("food-safety decisions cannot become an ordinary guarantee without evidence", async () => {
  const request = {
    ...input,
    message: "Is this cake safe for the customer to eat?",
  };
  await assert.rejects(
    run(
      { type: "message", content: "Yes, the cake is safe.", sources: [] },
      [],
      request,
    ),
    ProviderError,
  );
  const result = await runMainAgent(request, {
    mode: "demo",
    documents: [],
    now,
  });
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.equal(result.risk, "high");
  assert.match(result.actions[0], /Do not confirm/);
});

test("unsupported ordinary provider claims are replaced with missing-evidence clarification", async () => {
  const result = await run(
    {
      type: "message",
      content: "All products here are safe and every change is allowed.",
      sources: [],
    },
    [],
    { ...input, message: "Where is the checklist?" },
  );
  assert.equal(result.type, "message");
  if (result.type !== "message") assert.fail();
  assert.match(result.content, /could not find a current policy/);
  assert.ok(!result.content.includes("every change is allowed"));
});

test("unsupported low-risk Action Card instructions also use application-owned verification", async () => {
  const result = await run(
    { ...card, risk: "low", confidence: "low", sources: [] },
    [],
    { ...input, message: "Where is the checklist?" },
  );
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.ok(!result.actions.includes(card.actions[0]));
  assert.match(result.summary, /manager verification/);
  assert.equal(result.escalate, true);
});

test("demo mode runs the same retrieval and risk checks without a provider", async () => {
  const result = await runMainAgent(
    { ...input, model: "demo-gpt" },
    { mode: "demo", documents: [company], now },
  );
  assert.equal(result.type, "action");
  if (result.type !== "action") assert.fail();
  assert.equal(result.risk, "high");
  assert.equal(result.confidence, "medium");
  assert.deepEqual(result.sources, [source]);
});

test("knowledge endpoint exposes only current role-appropriate policy metadata", async () => {
  const options = {
    now,
    documents: [
      company,
      { ...company, documentId: "retired", status: "retired" as const },
      { ...company, documentId: "other-role", roles: ["cashier" as const] },
    ],
  };
  const response = await handleApiRequest(
    new Request("https://test.local/api/knowledge?employee_role=waiter"),
    options,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const catalog = await response.json();
  assert.equal(catalog.mode, "company");
  assert.equal(catalog.documents.length, 1);
  assert.deepEqual(catalog.documents[0].sections, [source]);
  assert.equal(catalog.documents[0].roles, undefined);
  assert.equal(catalog.documents[0].status, undefined);
});

test("knowledge endpoint rejects bad methods and roles and supports empty catalogs", async () => {
  const badRole = await handleApiRequest(
    new Request("https://test.local/api/knowledge?employee_role=manager"),
  );
  assert.equal(badRole.status, 400);
  const method = await handleApiRequest(
    new Request("https://test.local/api/knowledge", { method: "POST" }),
  );
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET");
  const empty = await handleApiRequest(
    new Request("https://test.local/api/knowledge"),
    { documents: [], now },
  );
  assert.deepEqual(await empty.json(), { mode: "none", documents: [] });
});
