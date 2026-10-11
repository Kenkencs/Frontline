import type { RiskLevel } from "../../shared/chat";
import type { KnowledgeResult } from "../knowledge/types";

export interface RiskAssessment {
  risk: RiskLevel;
  escalate: boolean;
  requiresAction: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
  requiredActions: string[];
}

// These rules provide a conservative floor, not a complete safety classifier.
// Negation does not remove a hazard: a worker's wording cannot verify food safety.
const allergy =
  /\b(allerg\w*|peanuts?|nuts?|anaphyla\w*)\b|花生|過敏|过敏|堅果|坚果/i;
const emergency =
  /\b(shortness of breath|trouble breathing|difficulty breathing|cannot breathe|can.?t breathe|wheez\w*|chok\w*|unconscious|collaps\w*|faint\w*|severe bleeding|throat swelling|swollen throat)\b|喘|呼吸困難|呼吸困难|不能呼吸|窒息|昏迷|暈倒|晕倒|大量出血/i;
const violenceOrRobbery =
  /\b(rob|robbery|robbed|robber\w*|violent|violence|assault\w*|attacking|attacked|fighting|gun\w*|firearm\w*|weapon\w*)\b|\b(threat\w*|point\w*|brandish\w*|pull\w*)\b.*\b(knife|knives)\b|\b(knife|knives)\b.*\b(threat\w*|attack\w*|brandish\w*)\b|\b(threat\w*)\b.*\b(hurt|harm|kill|shoot|stab)\b|搶劫|抢劫|打劫|劫持|暴力|毆打|殴打|襲擊|袭击|持槍|持枪|槍支|枪支|武器|(?:威脅|威胁).*刀|刀.*(?:威脅|威胁|傷害|伤害|攻擊|攻击)|(?:威脅|威胁).*(?:傷害|伤害|殺|杀)/i;
const hazard =
  /\b(injur\w*|bleed\w*|burn\w*|fire|smoke|gas|chemical\w*|poison\w*|electric shock|food safety|unsafe food|food poisoning|cross[- ]?contamination|spoil\w*|mould\w*|mold\w*|undercooked|raw chicken)\b|受傷|受伤|流血|出血|燒傷|烧伤|火災|火灾|燃氣|燃气|煤氣|煤气|化學|化学|中毒|電擊|电击|食品安全|食物安全|交叉污染|變質|变质|未煮熟/i;
const moneyOrComplaint =
  /\b(refund\w*|payment\w*|cash|till|money|discount\w*|void|transaction\w*|complain\w*|angry|abusive|theft|harass\w*|authoriz\w*|permission\w*)\b|退款|退錢|退钱|付款|支付|現金|现金|收銀|收银|投訴|投诉|客訴|客诉|折扣|騷擾|骚扰|授權|授权/i;
const receiptPrinting = /\breceipt\b.*\bprint\w*\b|\bprint\w*\b.*\breceipt\b/i;
const explicitPermission =
  /\b(am i allowed|are we allowed|(?:un)?authori[sz]\w*|unapproved|permission|bypass\w*|skip\w*|overrid\w*|ignor\w*|exceptions?)\b|\b(chang\w*|alter\w*|deviat\w*)\b.*\b(procedur\w*|policy|policies|checklist|opening|closing|time|temperature|recipe|limit|price|rule|step)\b|可不可以|可否|能否|是否允許|是否允许|允許|允许|授權|授权/i;

function asksForPermission(message: string): boolean {
  if (explicitPermission.test(message)) return true;
  // Check each occurrence, so a routine question cannot hide a second request
  // for permission. "What should I check?" asks for guidance, not an exception.
  return [...message.matchAll(/\b(can|may|should) (i|we)\b/gi)].some(
    (match) => {
      const before = message.slice(0, match.index);
      const after = message.slice(match.index! + match[0].length);
      const routinePrefix =
        /\b(what(?: (?:information|update|details))?|how|where|which (?:version|procedure|checklist))\s*$/i.test(
          before,
        );
      const routineVerb =
        /^\s+(do|check|record|tell|say|ask|share|confirm|give|help|find|explain|respond|coordinate|start|use|arrange|look|locate|keep)\b/i.test(
          after,
        );
      return !(routinePrefix && routineVerb);
    },
  );
}

const possibleContamination =
  /\braw\b.*\bready[- ]to[- ]eat\b.*\b(mix\w*|touch\w*|contact)\b|\bready[- ]to[- ]eat\b.*\braw\b.*\b(mix\w*|touch\w*|contact)\b/i;
const foodSafetyDecision =
  /\b(food|cake|meal|dish|product|eat|serve)\b.*\b(safe|okay|ok)\b|\b(safe|okay|ok)\b.*\b(food|cake|meal|dish|product|eat|serve)\b|\b(can|may|should) (she|he|they|the customer) eat\b|可.*食用|能.*吃|安全.*食|食.*安全/i;

export function assessRisk(
  message: string,
  knowledge: KnowledgeResult,
): RiskAssessment {
  const hasAllergy = allergy.test(message);
  const hasViolence = violenceOrRobbery.test(message);
  const hasEmergency = emergency.test(message) || hasViolence;
  const hasHazard = hazard.test(message) || possibleContamination.test(message);
  const foodDecision = foodSafetyDecision.test(message);
  const permissionDecision = asksForPermission(message);
  const needsApproval =
    moneyOrComplaint.test(message) || receiptPrinting.test(message);
  const missing =
    knowledge.missing || knowledge.mode === "none" || !knowledge.sources.length;
  const sample = knowledge.mode === "sample";
  const verifiedCompanyEvidence = knowledge.mode === "company" && !missing;

  let risk: RiskLevel = "low";
  let reason =
    "No listed high-risk trigger was detected. This does not verify that the situation is safe.";
  const requiredActions: string[] = [];

  if (hasAllergy || hasEmergency || hasHazard || foodDecision) {
    risk = "high";
    reason = hasEmergency
      ? "Possible immediate danger; follow the workplace emergency procedure."
      : hasAllergy
        ? "Possible allergy case; food safety must be verified with the manager."
        : foodDecision
          ? "Food safety cannot be confirmed from a policy match; verify the exact product with the manager."
          : "Possible safety hazard; stop the unsafe activity and get manager help.";
    if (hasEmergency) {
      requiredActions.push(
        "Follow the workplace emergency procedure; contact local emergency services if there is immediate danger.",
        "Alert the manager immediately. Do not delay emergency help while checking documents.",
      );
    }
    if (hasViolence) {
      requiredActions.push(
        "Do not confront the person or attempt to intervene.",
      );
    }
    if (hasAllergy || foodDecision) {
      requiredActions.push(
        "Do not confirm that the food is safe.",
        "Check the latest allergen information.",
        "Check cross-contamination information.",
        "Ask the manager if safety cannot be verified.",
      );
    } else if (hasHazard && !hasViolence) {
      requiredActions.push(
        "Stop the unsafe activity and follow the current workplace safety procedure.",
        "Keep people away from the hazard where it is safe to do so.",
        "Ask the manager to verify the next safe action.",
      );
    }
  } else if (needsApproval) {
    risk = "medium";
    if (/\brefund\w*\b|退款|退錢|退钱/i.test(message)) {
      reason = "Refund request: check the transaction and your approval limit.";
      requiredActions.push(
        "Check the receipt or transaction record and clarify the reason for the refund.",
        "Check the current company refund policy and your authority before promising or processing a refund.",
        "Ask the manager to approve a refund or exception outside your authority.",
      );
    } else if (receiptPrinting.test(message)) {
      reason =
        "Receipt printing: confirm the transaction and check the printer.";
      requiredActions.push(
        "Check whether the payment completed in the register before taking another payment.",
        "Check the printer's paper and displayed error using the approved instructions.",
        "Use the permitted receipt-reprint process; ask the manager if the transaction is unclear or the printer still fails.",
      );
    } else if (/\b(cash|till|money)\b|現金|现金|收銀|收银/i.test(message)) {
      reason = "Cash handling: check the records before making an adjustment.";
      requiredActions.push(
        "Compare the register records with the reported difference, following the current cash-handling procedure.",
        "Record the facts; do not change transaction records, conceal a difference, or cover it with personal money.",
        "Ask the manager to review any unresolved difference before an adjustment.",
      );
    } else if (/\b(payment\w*|transaction\w*)\b|付款|支付/i.test(message)) {
      reason =
        "Payment issue: establish the transaction status before trying again.";
      requiredActions.push(
        "Check the register's transaction status and any receipt or terminal error.",
        "Do not repeat the charge or issue money while the transaction status is unclear.",
        "Follow the current payment procedure; ask the manager if the issue remains unresolved or requires approval.",
      );
    } else if (
      /\b(complain\w*|angry|abusive|harass\w*)\b|投訴|投诉|客訴|客诉|騷擾|骚扰/i.test(
        message,
      )
    ) {
      reason =
        "Customer concern: clarify the issue and the available next step.";
      requiredActions.push(
        "Listen calmly and confirm the customer's concern without promising an outcome.",
        "Check the current company policy and your authority before offering a remedy or exception.",
        "Involve the manager if the issue is outside your authority, remains unresolved, or you feel unsafe.",
      );
    } else {
      reason = "Check your approval limit before making an exception.";
      requiredActions.push(
        "Check the current company policy and your authority before making a refund, payment, or exception.",
        "Ask the manager to approve any action you are not authorized to take.",
      );
    }
  }

  if (permissionDecision) {
    requiredActions.push(
      "Check the current procedure and ask the manager to verify your authority before changing it or making an exception.",
    );
    if (risk === "low")
      reason =
        "Changing a workplace procedure or making an exception may need approval.";
  }

  if (missing) {
    requiredActions.push(
      "Ask the manager for the current relevant company policy before taking action.",
    );
    if (risk === "low" && !permissionDecision)
      reason = "The current company procedure is missing for this question.";
  } else if (sample) {
    requiredActions.push(
      risk !== "low" || permissionDecision
        ? "Ask the manager to verify the current company policy; the retrieved documents are fictional samples."
        : "Sample guidance: check your current workplace procedure.",
    );
  }

  const escalate = risk !== "low" || missing || permissionDecision;
  return {
    risk,
    escalate,
    // Escalation can be a verification sentence in an ordinary reply. It does
    // not turn every missing/sample document question into an Action Card.
    requiresAction: risk !== "low" || permissionDecision,
    confidence: verifiedCompanyEvidence ? "medium" : "low",
    reason,
    requiredActions: [...new Set(requiredActions)],
  };
}
