import type { EmployeeRole } from "../../shared/chat";
import type { KnowledgeDocument } from "./types";

// Fictional FAQ content for exercising role-aware retrieval and the UI.
// "Approved" describes the sample workflow, not real company approval.
function roleFaq(
  role: EmployeeRole,
  title: string,
  sections: KnowledgeDocument["sections"],
): KnowledgeDocument {
  return {
    documentId: `${role}-faq`,
    revision: 1,
    title,
    version: "v1",
    status: "approved",
    effectiveFrom: "2026-01-01",
    reviewBy: "2027-12-31",
    roles: [role],
    sample: true,
    sections,
  };
}

export const roleDocuments: KnowledgeDocument[] = [
  roleFaq("cashier", "Cashier: everyday questions", [
    {
      id: "declined-card",
      section: "FAQ 1",
      category: "Payments",
      question: "What should I do when a customer's card is declined?",
      excerpt:
        "Read the payment terminal's message without exposing private card details. Explain that the payment was not confirmed and offer another accepted payment method. Follow the current company procedure; ask the manager if the payment status is unclear rather than repeatedly charging the card.",
      keywords: ["card declined", "declined card", "terminal declined"],
    },
    {
      id: "duplicate-charge",
      section: "FAQ 2",
      category: "Payments",
      question:
        "A customer reports a duplicate card charge. How do I check it?",
      excerpt:
        "Record the transaction reference and check the register's payment record using the approved process. Avoid collecting a full card number. Ask the manager to investigate the reported duplicate; do not promise a refund or repeat the transaction before its status is verified.",
      keywords: ["duplicate charge", "charged twice", "duplicate card"],
    },
    {
      id: "cash-difference",
      section: "FAQ 3",
      category: "Cash handling",
      question:
        "The cash drawer total does not match the register. What should I do?",
      excerpt:
        "Pause the reconciliation and recount using the company cash-handling procedure. Keep the transaction records together and report the difference to the manager. Do not use personal money, change a transaction record, or conceal the mismatch.",
      keywords: [
        "cash drawer",
        "cash difference",
        "register total",
        "drawer mismatch",
      ],
    },
    {
      id: "missing-receipt",
      section: "FAQ 4",
      category: "Checkout",
      question: "The receipt did not print after payment. What should I check?",
      excerpt:
        "Confirm the transaction status in the register before attempting another payment. Check the printer's paper and displayed error using the approved instructions. Reprint the receipt through the permitted process or ask the manager for help; protect the customer's transaction information.",
      keywords: [
        "receipt print",
        "receipt printer",
        "missing receipt",
        "printer paper",
      ],
    },
    {
      id: "incorrect-price",
      section: "FAQ 5",
      category: "Checkout",
      question:
        "The scanned price differs from the shelf label. How should I respond?",
      excerpt:
        "Check the exact item and current price record, then explain that you are verifying the difference. Ask the manager to resolve the discrepancy using the current pricing procedure. Do not invent a price override or promise an exception you cannot approve.",
      keywords: [
        "scanned price",
        "shelf label",
        "price differs",
        "price discrepancy",
      ],
    },
    {
      id: "promo-code",
      section: "FAQ 6",
      category: "Checkout",
      question:
        "A promotion code is rejected at checkout. What should I check?",
      excerpt:
        "Check the current promotion details and whether the entered code matches the offer. Explain any confirmed restriction clearly. Ask the manager about unclear eligibility or a manual adjustment; do not invent a discount or change the promotion rules.",
      keywords: [
        "promotion code",
        "promo code",
        "promotion rejected",
        "offer eligibility",
      ],
    },
    {
      id: "gift-voucher",
      section: "FAQ 7",
      category: "Payments",
      question: "A gift voucher will not redeem. How do I handle it?",
      excerpt:
        "Use the approved voucher-checking process to confirm the voucher type and redemption status. Keep its code private. If the register cannot verify it, ask the manager before accepting it or changing its balance; explain the next step without promising that it is valid.",
      keywords: ["gift voucher", "voucher redeem", "voucher balance"],
    },
    {
      id: "refund-request",
      section: "FAQ 8",
      category: "Customer care",
      question:
        "A customer asks for a refund at the till. What information should I collect?",
      excerpt:
        "Listen to the request and record the item, transaction reference, and reason through the approved process. Check the current refund policy and your authority. Refer an uncertain or unauthorized refund to the manager before promising money or an alternative remedy.",
      keywords: ["refund till", "refund request", "refund information"],
    },
    {
      id: "long-queue",
      section: "FAQ 9",
      category: "Service",
      question:
        "The checkout queue is getting long. How can I keep customers informed?",
      excerpt:
        "Acknowledge the wait and give only information you can confirm. Tell the manager or designated colleague that checkout support is needed. Continue the approved checkout checks and keep walkways clear rather than skipping transaction steps or promising an unsupported waiting time.",
      keywords: ["checkout queue", "long queue", "queue support"],
    },
    {
      id: "split-tender",
      section: "FAQ 10",
      category: "Payments",
      question:
        "A customer wants to split payment between two methods. What should I verify?",
      excerpt:
        "Check whether the register and current company procedure support the requested payment methods. Confirm the remaining balance after each approved payment. Ask the manager if the sequence or transaction status is unclear; do not duplicate a charge or accept an unsupported method.",
      keywords: [
        "split payment",
        "two methods",
        "split tender",
        "remaining balance",
      ],
    },
    {
      id: "offline-register",
      section: "FAQ 11",
      category: "Equipment",
      question: "The checkout register is offline. What should I do next?",
      excerpt:
        "Read the displayed error and notify the manager. Use only an approved outage procedure and keep a record of any interrupted transaction. Do not record card details yourself, invent an offline payment process, or claim a payment succeeded without confirmation.",
      keywords: [
        "register offline",
        "checkout offline",
        "register outage",
        "interrupted transaction",
      ],
    },
    {
      id: "cash-handover",
      section: "FAQ 12",
      category: "Cash handling",
      question:
        "What should I record when transferring the cash drawer to another cashier?",
      excerpt:
        "Follow the company's cash-transfer process with the responsible colleague. Record the confirmed drawer balance, unresolved transactions, and any discrepancy through the approved record. Ask the manager to resolve missing information; avoid exposing cash amounts or customer details to bystanders.",
      keywords: [
        "transferring cash drawer",
        "cash transfer",
        "drawer balance",
        "another cashier",
      ],
    },
  ]),
  roleFaq("waiter", "Waiter: everyday questions", [
    {
      id: "sold-out-dish",
      section: "FAQ 1",
      category: "Orders",
      question:
        "The dish a guest ordered has sold out. How should I explain it?",
      excerpt:
        "Confirm the dish's availability with the kitchen before speaking to the guest. Explain the change clearly and offer only available alternatives with confirmed details. Check any dietary concern separately and ask the manager about adjustments you cannot approve.",
      keywords: ["dish sold out", "sold out", "dish availability"],
    },
    {
      id: "order-correction",
      section: "FAQ 2",
      category: "Orders",
      question:
        "I entered the wrong dish on a guest's order. What should I do?",
      excerpt:
        "Tell the kitchen or responsible colleague promptly and confirm the guest's intended order. Follow the approved order-correction process so preparation and the bill remain consistent. Ask the manager about any charge adjustment or prepared-food decision outside your authority.",
      keywords: [
        "wrong dish",
        "order correction",
        "entered wrong",
        "intended order",
      ],
    },
    {
      id: "dish-delay",
      section: "FAQ 3",
      category: "Service",
      question: "A guest's dish is delayed. What update can I give?",
      excerpt:
        "Check the order's actual status with the kitchen and acknowledge the guest's wait. Share only a confirmed update; do not invent a completion time. Alert the manager if the delay remains unresolved or the guest requests an exception.",
      keywords: [
        "dish delayed",
        "dish delay",
        "order status",
        "completion time",
      ],
    },
    {
      id: "dietary-preference",
      section: "FAQ 4",
      category: "Menu questions",
      question:
        "A guest asks whether a dish meets their dietary preference. How should I check?",
      excerpt:
        "Clarify the guest's specific preference and consult the current recipe or ingredient record for the exact dish. Confirm changes with the kitchen rather than guessing. If the request concerns an allergy or safety, follow the allergen procedure and involve the manager before making a safety claim.",
      keywords: [
        "dietary preference",
        "dietary request",
        "specific preference",
      ],
    },
    {
      id: "shared-bill",
      section: "FAQ 5",
      category: "Billing",
      question: "Guests ask to divide a shared bill. What should I confirm?",
      excerpt:
        "Confirm how the guests want the bill divided and check the register's supported process. Verify the items and remaining amount before processing payment. Ask the cashier or manager if the allocation is unclear or a bill adjustment needs approval.",
      keywords: [
        "shared bill",
        "divide bill",
        "bill divided",
        "bill allocation",
      ],
    },
    {
      id: "table-spill",
      section: "FAQ 6",
      category: "Service",
      question: "A drink spills beside a guest's table. What should I do?",
      excerpt:
        "Warn nearby guests about the spill and keep the affected area clear where it is safe to do so. Notify the responsible colleague and use the approved cleanup procedure. Ask the manager for help if someone is hurt or the hazard cannot be controlled.",
      keywords: ["drink spills", "table spill", "guest table", "spill cleanup"],
    },
    {
      id: "large-party",
      section: "FAQ 7",
      category: "Seating",
      question:
        "An unexpected large party arrives. How should I arrange seating?",
      excerpt:
        "Check the current table availability and seating plan with the responsible colleague. Explain any confirmed wait and keep access routes clear. Ask the manager before changing the seating arrangement or promising space that has not been verified.",
      keywords: [
        "large party",
        "arrange seating",
        "seating plan",
        "unexpected party",
      ],
    },
    {
      id: "dish-modification",
      section: "FAQ 8",
      category: "Orders",
      question:
        "A guest requests a dish modification. What should I ask the kitchen?",
      excerpt:
        "Record the exact requested change and confirm whether the kitchen can prepare it using the current recipe and procedure. Check any ingredient or allergy concern separately. Do not promise a modification, safety, or price adjustment until the responsible colleague has verified it.",
      keywords: ["dish modification", "requested change", "modify dish"],
    },
    {
      id: "table-transfer",
      section: "FAQ 9",
      category: "Teamwork",
      question:
        "Another server is taking over my table. What information should I share?",
      excerpt:
        "Share the table's confirmed orders, pending requests, served items, and unresolved issues through the approved team process. Make sure the new server understands any recorded dietary concern. Protect guest information and involve the manager if responsibility or a pending decision is unclear.",
      keywords: [
        "server taking over",
        "table transfer",
        "new server",
        "pending requests",
      ],
    },
    {
      id: "cold-meal",
      section: "FAQ 10",
      category: "Customer care",
      question: "A guest says their meal arrived cold. How should I respond?",
      excerpt:
        "Listen to the concern and confirm the dish and what happened with the kitchen. Follow the current remedy procedure and ask the manager about replacement, reheating, or a bill adjustment. Do not promise a refund or make a food-safety decision without the required verification.",
      keywords: ["meal cold", "arrived cold", "cold meal", "reheating"],
    },
    {
      id: "lost-property",
      section: "FAQ 11",
      category: "Guest assistance",
      question: "A guest reports lost property. How should I help?",
      excerpt:
        "Record a description and where the item was last seen using the company's lost-property process. Check with the responsible colleague and keep any found item secure. Verify ownership through the approved procedure; do not disclose another guest's details or hand over an item based on a guess.",
      keywords: [
        "lost property",
        "found item",
        "lost item",
        "verify ownership",
      ],
    },
    {
      id: "menu-clarification",
      section: "FAQ 12",
      category: "Menu questions",
      question:
        "I cannot explain a menu description to a guest. Where should I check?",
      excerpt:
        "Consult the current menu information and ask the kitchen or designated colleague about the exact dish. Explain only confirmed preparation and ingredient details. If the information is missing or concerns safety, ask the manager rather than inventing an answer.",
      keywords: [
        "menu description",
        "menu information",
        "explain menu",
        "menu clarification",
      ],
    },
  ]),
  roleFaq("kitchen_staff", "Kitchen staff: everyday questions", [
    {
      id: "missing-ingredient",
      section: "FAQ 1",
      category: "Preparation",
      question:
        "A recipe ingredient is missing. What should I do before preparing the dish?",
      excerpt:
        "Tell the responsible kitchen colleague which ingredient is unavailable. Check the approved recipe and substitution process before changing the dish. Ask the manager about an unapproved replacement and update the service team with confirmed availability and ingredient information.",
      keywords: [
        "ingredient missing",
        "missing ingredient",
        "recipe ingredient",
        "unapproved replacement",
      ],
    },
    {
      id: "unlabelled-container",
      section: "FAQ 2",
      category: "Food records",
      question:
        "I find an unlabelled container in storage. What should I check?",
      excerpt:
        "Set the container aside according to the company's procedure until its contents and handling history can be verified. Check the relevant preparation and storage records with the responsible colleague. Do not guess a label, date, ingredient, or permission to use the contents; ask the manager if records are missing.",
      keywords: [
        "unlabelled container",
        "unlabeled container",
        "container label",
        "handling history",
      ],
    },
    {
      id: "delivery-mismatch",
      section: "FAQ 3",
      category: "Stock",
      question:
        "A supplier delivery differs from the order. What should I record?",
      excerpt:
        "Compare the delivered items with the approved order and record the discrepancy through the receiving process. Keep the supplier's product information available for verification. Ask the manager about accepting, substituting, or returning an item that does not match the order.",
      keywords: [
        "supplier delivery",
        "delivery differs",
        "delivery mismatch",
        "receiving discrepancy",
      ],
    },
    {
      id: "equipment-fault",
      section: "FAQ 4",
      category: "Equipment",
      question: "A kitchen appliance shows a fault. What should I do?",
      excerpt:
        "Stop using the affected appliance and notify the responsible colleague or manager. Follow the current equipment procedure and mark it unavailable through the approved process. Do not attempt an unauthorized repair or resume use until the required check has been completed.",
      keywords: [
        "appliance fault",
        "shows fault",
        "equipment fault",
        "affected appliance",
      ],
    },
    {
      id: "ticket-backlog",
      section: "FAQ 5",
      category: "Service coordination",
      question:
        "Kitchen tickets are backing up. How should I coordinate with the service team?",
      excerpt:
        "Tell the responsible colleague which orders are affected and confirm the preparation priorities through the team process. Give the service team updates you can verify. Ask the manager for support rather than skipping recipe, handling, or checking steps to catch up.",
      keywords: [
        "tickets backing up",
        "ticket backlog",
        "preparation priorities",
        "orders affected",
      ],
    },
    {
      id: "recipe-uncertainty",
      section: "FAQ 6",
      category: "Preparation",
      question: "Two recipe instructions conflict. Which version should I use?",
      excerpt:
        "Check the current approved recipe and its version information. Pause an uncertain preparation step and ask the responsible colleague or manager to resolve the conflict. Do not combine instructions from different revisions or rely on memory when the approved version is unclear.",
      keywords: [
        "recipe instructions conflict",
        "recipe conflict",
        "recipe version",
        "different revisions",
      ],
    },
    {
      id: "raw-food-separation",
      section: "FAQ 7",
      category: "Food handling",
      question:
        "Raw and ready-to-eat ingredients may have mixed. What should I do?",
      excerpt:
        "Pause use of the affected ingredients and follow the current cross-contamination procedure. Identify the utensils, surfaces, and products involved with the responsible colleague. Ask the manager to verify the next action; do not claim the ingredients are safe or decide to serve them without verification.",
      keywords: [
        "raw ready to eat",
        "ingredients mixed",
        "raw food separation",
        "affected ingredients",
      ],
    },
    {
      id: "temperature-record",
      section: "FAQ 8",
      category: "Food records",
      question: "A required temperature record is missing. What should I do?",
      excerpt:
        "Report the missing record to the responsible colleague and check the current company monitoring procedure. Take only the checks the approved process requires and record the actual result accurately. Do not invent a previous reading, a temperature limit, or proof that a product is safe; ask the manager about its disposition.",
      keywords: [
        "temperature record",
        "missing reading",
        "monitoring record",
        "previous reading",
      ],
    },
    {
      id: "cleaning-product",
      section: "FAQ 9",
      category: "Cleaning",
      question:
        "I am unsure which cleaning product to use on a food-contact surface. Where should I check?",
      excerpt:
        "Check the current cleaning procedure and the approved product's instructions with the responsible colleague. Confirm the intended surface and required handling before use. Do not mix products or invent a dilution or contact time; ask the manager if the instructions cannot be verified.",
      keywords: [
        "cleaning product",
        "food contact surface",
        "product instructions",
        "dilution",
      ],
    },
    {
      id: "waste-record",
      section: "FAQ 10",
      category: "Stock",
      question:
        "Food has been set aside as waste. What information should I record?",
      excerpt:
        "Use the approved waste-recording process to note the item, observed issue, quantity, and responsible person. Keep waste separate according to the current procedure. Ask the manager about an uncertain decision; do not return the item to service or invent a reason or quantity.",
      keywords: [
        "waste record",
        "food waste",
        "set aside waste",
        "waste recording",
      ],
    },
    {
      id: "batch-identification",
      section: "FAQ 11",
      category: "Food records",
      question:
        "I cannot identify which preparation batch an item belongs to. What should I do?",
      excerpt:
        "Pause use of the item and check the approved batch and preparation records with the responsible colleague. Keep its existing label and product information available. Ask the manager if its identity or handling cannot be established; do not invent a batch reference or a use-by date.",
      keywords: [
        "preparation batch",
        "batch identification",
        "batch reference",
        "identify batch",
      ],
    },
    {
      id: "unfinished-prep",
      section: "FAQ 12",
      category: "Teamwork",
      question:
        "My shift ends with unfinished preparation. What should I tell the next colleague?",
      excerpt:
        "Record the confirmed preparation stage, item identity, storage location, and unresolved checks through the approved team process. Explain which tasks still need completion and identify the responsible colleague. Ask the manager about unclear handling or responsibility rather than marking an unfinished task complete.",
      keywords: [
        "unfinished preparation",
        "unfinished prep",
        "preparation stage",
        "next colleague",
      ],
    },
  ]),
];
