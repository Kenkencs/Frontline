import type { EmployeeRole } from "../../shared/chat";
import type { KnowledgeDocument } from "./types";

// Fictional examples only. Replace content and approval/version metadata with
// verified company documents before setting sample: false. Edit this file to add SOPs.
const staffRoles: EmployeeRole[] = ["waiter", "cashier", "kitchen_staff"];
function sampleDocument(
  documentId: string,
  revision: number,
  title: string,
  sections: KnowledgeDocument["sections"],
  status: KnowledgeDocument["status"] = "approved",
): KnowledgeDocument {
  return {
    documentId,
    revision,
    title,
    version: `v${revision}`,
    status,
    effectiveFrom: "2026-01-01",
    reviewBy: "2027-12-31",
    roles: staffRoles,
    sample: true,
    sections,
  };
}

export const knowledgeDocuments: KnowledgeDocument[] = [
  sampleDocument(
    "food-safety",
    2,
    "Food Safety SOP",
    [
      {
        id: "allergy",
        section: "§4.2",
        excerpt:
          "Retired sample procedure. This older revision must never be used as current evidence.",
        keywords: ["allergy", "allergic", "peanut"],
      },
    ],
    "retired",
  ),
  sampleDocument("food-safety", 3, "Food Safety SOP", [
    {
      id: "allergy",
      section: "§4.2",
      excerpt:
        "For a reported severe allergy, do not confirm food is safe. Check current allergen and cross-contamination records. If safety cannot be verified, pause the decision and ask the manager.",
      keywords: [
        "allergy",
        "allergies",
        "allergic",
        "peanut",
        "nuts",
        "cross contamination",
      ],
    },
  ]),
  sampleDocument("allergen-guide", 2, "Allergen Guide", [
    {
      id: "verification",
      section: "§2.1",
      excerpt:
        "Check the current ingredient and allergen records for the exact product, including cross-contamination information. Missing or unclear information requires manager verification; never guess that a product is safe.",
      keywords: [
        "allergy",
        "allergies",
        "allergic",
        "allergen",
        "allergens",
        "ingredient",
        "ingredients",
        "peanut",
        "cross contamination",
      ],
    },
  ]),
  sampleDocument("opening-checklist", 1, "Opening Shift Checklist", [
    {
      id: "opening",
      section: "§1.1",
      excerpt:
        "Read the handover, check that your station is ready, review unavailable items, and ask the shift manager about missing information before starting service.",
      keywords: [
        "opening",
        "open shift",
        "start shift",
        "checklist",
        "handover",
        "station",
      ],
    },
  ]),
  sampleDocument("customer-care", 1, "Customer Care SOP", [
    {
      id: "complaints",
      section: "§3.2",
      excerpt:
        "Listen, clarify the issue, and record the complaint. Check the approved remedy policy before promising a refund. Escalate unresolved complaints, safety concerns, or requests outside your authority to the manager.",
      keywords: [
        "complaint",
        "complaints",
        "refund",
        "refunds",
        "overcharged",
        "unhappy",
        "remedy",
      ],
    },
  ]),
  sampleDocument("emergency-response", 1, "Emergency Response SOP", [
    {
      id: "urgent-help",
      section: "§1.1",
      excerpt:
        "Alert the manager or designated first-aid person immediately. Follow the workplace emergency procedure and contact local emergency services when immediate danger is reported. Do not delay getting help while searching policy records.",
      keywords: [
        "emergency",
        "injury",
        "injured",
        "choking",
        "collapse",
        "fire",
        "bleeding",
        "breathing",
      ],
    },
  ]),
];
