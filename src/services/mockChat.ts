import type {
  ActionResponse,
  ChatRequest,
  ChatResponse,
} from "../../shared/chat";
import { samplePolicies } from "../data/samplePolicies";

export const allergyAction: ActionResponse = {
  type: "action",
  risk: "high",
  summary: "Possible severe food allergy case.",
  actions: [
    "Do not confirm that the food is safe.",
    "Check the latest allergen information.",
    "Check cross-contamination information.",
    "Escalate to the manager if safety cannot be verified.",
  ],
  sources: samplePolicies.slice(0, 2),
  confidence: "high",
  escalate: true,
};

// Only a few demonstration scenarios. Keyword matching is not a risk assessment or an AI agent.
export function getMockResponse(request: ChatRequest): ChatResponse {
  const message = request.message.toLowerCase();
  if (/allerg|peanut|\bnuts?\b/.test(message)) return allergyAction;

  if (/refund|complaint|angry|unhappy/.test(message)) {
    return {
      type: "action",
      risk: "medium",
      summary: "A customer concern needs your attention.",
      actions: [
        "Listen to the customer and acknowledge the concern.",
        "Confirm the order details.",
        "Ask your manager before approving a refund or exception.",
      ],
      sources: [samplePolicies[3]],
      confidence: "high",
      escalate: true,
    };
  }

  if (/opening|open\b|shift|checklist/.test(message)) {
    return {
      type: "message",
      content:
        "Start with the shift handover. Check your workstation, confirm today’s unavailable items, and ask your manager about any outstanding issues.\n\nYou can find the sample checklist below.",
      sources: [samplePolicies[2]],
    };
  }

  return {
    type: "message",
    content:
      "This prototype has sample answers for allergy concerns, opening a shift, and customer complaints. Try one of those situations to see how a reply works.\n\nThere is no live AI or company knowledge connected yet.",
    sources: [],
  };
}
