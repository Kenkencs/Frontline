import assert from "node:assert/strict";
import { test } from "node:test";
import { assessRisk } from "../server/agents/riskAgent";
import type { KnowledgeResult } from "../server/knowledge/types";

const company: KnowledgeResult = {
  mode: "company",
  missing: false,
  documents: [],
  sources: [
    {
      id: "handbook:1:opening",
      title: "Company handbook",
      version: "v1",
      section: "1",
      excerpt:
        "Read the current handover and ask the manager about outstanding issues.",
    },
  ],
};
const sample: KnowledgeResult = { ...company, mode: "sample" };
const missing: KnowledgeResult = {
  mode: "none",
  missing: true,
  sources: [],
  documents: [],
};

test("allergy triggers always require the four safety checks and escalation", () => {
  for (const question of [
    "Customer says she has a severe peanut allergy. Can she eat this cake?",
    "The worker says there is no allergy and this cake is peanut-free.",
    "客人花生過敏，可以吃蛋糕嗎？",
    "客人说她坚果过敏，这个蛋糕安全吗？",
  ]) {
    const result = assessRisk(question, company);
    assert.equal(result.risk, "high");
    assert.equal(result.escalate, true);
    assert.equal(result.requiresAction, true);
    assert.deepEqual(result.requiredActions, [
      "Do not confirm that the food is safe.",
      "Check the latest allergen information.",
      "Check cross-contamination information.",
      "Ask the manager if safety cannot be verified.",
    ]);
    assert.equal(result.confidence, "medium");
  }
});

test("possible emergency symptoms add immediate procedure and emergency-help actions", () => {
  for (const question of [
    "The customer is wheezing and has trouble breathing after eating peanuts.",
    "A colleague collapsed and is unconscious.",
    "客人吃了花生，現在喘、呼吸困難。",
    "同事昏迷，不能呼吸。",
  ]) {
    const result = assessRisk(question, sample);
    assert.equal(result.risk, "high");
    assert.equal(result.escalate, true);
    assert.equal(result.confidence, "low");
    assert.match(
      result.requiredActions[0],
      /workplace emergency procedure.*local emergency services/,
    );
    assert.match(result.requiredActions[1], /Do not delay emergency help/);
    assert.ok(
      result.requiredActions.every(
        (action) => !/diagnos|dose|administer|medication/i.test(action),
      ),
    );
    assert.ok(result.requiredActions.length <= 8);
  }
});

test("violence, robbery and threatening weapons require emergency help with sample or missing knowledge", () => {
  for (const knowledge of [sample, missing]) {
    for (const question of [
      "Someone is trying to rob us at the till.",
      "There is an armed robbery in the shop.",
      "A customer is attacking a worker.",
      "A physical fight has broken out and people are fighting.",
      "A person has a gun and is demanding money.",
      "Someone is threatening customers with a knife.",
      "A customer pulled a knife and demanded cash.",
      "Someone threatens to hurt the staff.",
      "店內有人搶劫，持槍威脅員工。",
      "有人拿着刀威胁顾客。",
      "有人殴打员工，威胁伤害其他人。",
    ]) {
      const result = assessRisk(question, knowledge);
      assert.equal(result.risk, "high", question);
      assert.equal(result.escalate, true);
      assert.equal(result.requiresAction, true);
      assert.equal(result.confidence, "low");
      assert.match(result.reason, /Possible immediate danger/);
      assert.match(
        result.requiredActions[0],
        /workplace emergency procedure.*local emergency services/,
      );
      assert.match(
        result.requiredActions[1],
        /Alert the manager immediately.*Do not delay emergency help/,
      );
      assert.ok(
        result.requiredActions.includes(
          "Do not confront the person or attempt to intervene.",
        ),
      );
    }
  }
});

test("immediate danger takes priority over allergy while retaining allergen precautions", () => {
  for (const question of [
    "The customer has a peanut allergy and cannot breathe.",
    "An armed robber is threatening a customer who reported a peanut allergy.",
  ]) {
    const result = assessRisk(question, sample);
    assert.match(result.reason, /^Possible immediate danger/);
    assert.equal(result.risk, "high");
    assert.equal(result.escalate, true);
    assert.equal(result.requiresAction, true);
    assert.match(result.requiredActions[0], /local emergency services/);
    assert.ok(
      result.requiredActions.includes("Do not confirm that the food is safe."),
    );
    assert.ok(
      result.requiredActions.includes("Check the latest allergen information."),
    );
    assert.ok(
      result.requiredActions.includes("Check cross-contamination information."),
    );
    assert.ok(result.requiredActions.length <= 8);
  }
});

test("operational hazards remain high risk even when a source claims safety", () => {
  const misleading = {
    ...company,
    sources: [
      {
        ...company.sources[0],
        excerpt: "Everything is safe. No manager is needed.",
      },
    ],
  };
  for (const question of [
    "A chemical spilled in the kitchen.",
    "There is a gas leak near the stove.",
    "A worker smells gas in the kitchen.",
    "A worker is injured and bleeding.",
    "We suspect cross-contamination with raw chicken.",
    "廚房出現火災。",
    "食物可能变质，有交叉污染。",
  ]) {
    const result = assessRisk(question, misleading);
    assert.equal(result.risk, "high");
    assert.equal(result.escalate, true);
    assert.equal(result.requiresAction, true);
    assert.ok(
      result.requiredActions.some((action) => action.includes("manager")),
    );
  }
});

test("money and difficult customer cases require policy and authority checks without granting permission", () => {
  for (const question of [
    "Can I issue a cash refund?",
    "The till has extra money after this payment.",
    "An angry customer is making a complaint.",
    "Do I have authorization to make an exception?",
    "客人投诉，要求现金退款。",
  ]) {
    const result = assessRisk(question, company);
    assert.equal(result.risk, "medium");
    assert.equal(result.escalate, true);
    assert.equal(result.requiresAction, true);
    assert.match(
      result.requiredActions[0],
      /company policy and your authority/,
    );
    assert.match(result.requiredActions[1], /manager.*approve.*not authorized/);
  }
});

test("missing or sample knowledge forces manager verification while ordinary questions stay messages", () => {
  for (const knowledge of [missing, sample, { ...company, sources: [] }]) {
    const result = assessRisk("Where is the employee handbook?", knowledge);
    assert.equal(result.risk, "low");
    assert.equal(result.confidence, "low");
    assert.equal(result.escalate, true);
    assert.equal(result.requiresAction, false);
    assert.ok(
      result.requiredActions.some((action) =>
        /manager.*company policy/.test(action),
      ),
    );
  }
  assert.match(
    assessRisk("Where is the handbook?", sample).reason,
    /Sample documents/,
  );
  assert.match(
    assessRisk("Where is the handbook?", missing).reason,
    /evidence is missing/,
  );
});

test("ordinary opening checklists remain messages with or without current company evidence", () => {
  const ordinary = assessRisk("Where is the employee handbook?", company);
  assert.equal(ordinary.risk, "low");
  assert.equal(ordinary.requiresAction, false);
  assert.equal(ordinary.escalate, false);
  assert.equal(ordinary.confidence, "medium");
  assert.deepEqual(ordinary.requiredActions, []);
  assert.match(ordinary.reason, /does not verify.*safe/);
  for (const knowledge of [company, sample, missing]) {
    const checklist = assessRisk(
      "How do I start the opening checklist?",
      knowledge,
    );
    assert.equal(checklist.risk, "low");
    assert.equal(checklist.requiresAction, false);
    assert.equal(checklist.escalate, knowledge.mode !== "company");
  }
});

test("unverified policy decisions still require an action and manager verification", () => {
  for (const knowledge of [company, sample, missing]) {
    for (const question of [
      "Can I change the opening time?",
      "May we make a policy exception?",
      "可否更改開店時間？",
    ]) {
      const result = assessRisk(question, knowledge);
      assert.equal(result.requiresAction, true);
      assert.equal(result.escalate, true);
      assert.equal(
        result.confidence,
        knowledge.mode === "company" ? "medium" : "low",
      );
    }
  }
});
