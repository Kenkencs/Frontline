import type { Source } from "./chat";

// Fictional documents for UI development. These are not retrieved company policies.
export const samplePolicies: Source[] = [
  {
    id: "food-safety-4-2",
    title: "Food Safety SOP",
    version: "v3",
    section: "§4.2",
    excerpt:
      "Sample policy: When a customer reports a food allergy, do not promise a product is safe. Check the current ingredient and allergen records with the responsible manager. If the relevant information cannot be verified, escalate before making a recommendation.",
  },
  {
    id: "allergens-2-1",
    title: "Allergen Guide",
    version: "v2",
    section: "§2.1",
    excerpt:
      "Sample policy: Ingredient information alone does not verify the absence of cross-contamination. Check preparation equipment, storage, handling, and supplier information. Refer uncertain cases to the manager. This sample does not verify the safety of any specific food.",
  },
  {
    id: "opening-1-1",
    title: "Opening Shift Checklist",
    version: "v1",
    section: "§1.1",
    excerpt:
      "Sample policy: Read the shift handover, check your workstation, confirm today’s unavailable items, and ask the shift manager about any outstanding issues before opening.",
  },
  {
    id: "customer-care-3-2",
    title: "Customer Care SOP",
    version: "v1",
    section: "§3.2",
    excerpt:
      "Sample policy: Listen to the customer, acknowledge the concern, and confirm the order details. Ask the manager to approve any refund or exception you are not authorized to make.",
  },
];
