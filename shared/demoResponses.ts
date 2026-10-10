import type { ActionResponse, ChatResponse } from "./chat";
import { samplePolicies } from "./samplePolicies";

// Static fixtures seed the example conversations. New responses come from the backend.
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
  confidence: "low",
  escalate: true,
};

export const openingResponse: ChatResponse = {
  type: "message",
  content:
    "Start with the shift handover. Check your workstation, confirm today’s unavailable items, and ask your manager about any outstanding issues.\n\nYou can find the sample checklist below.",
  sources: [samplePolicies[2]],
};
