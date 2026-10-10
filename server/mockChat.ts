import type { ChatRequest, ChatResponse } from "../shared/chat";
import { allergyAction, openingResponse } from "../shared/demoResponses";
import { samplePolicies } from "../shared/samplePolicies";

// Demonstration keyword matching, not AI, retrieval, or a real risk assessment.
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
  if (/opening|open\b|shift|checklist/.test(message)) return openingResponse;
  return {
    type: "message",
    content:
      "This prototype has sample answers for allergy concerns, opening a shift, and customer complaints. Try one of those situations to see how a reply works.\n\nThere is no live AI or company knowledge connected yet.",
    sources: [],
  };
}
