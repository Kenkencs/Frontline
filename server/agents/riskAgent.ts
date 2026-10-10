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
const hazard =
  /\b(injur\w*|bleed\w*|burn\w*|fire|smoke|gas|chemical\w*|poison\w*|electric shock|food safety|unsafe food|food poisoning|cross[- ]?contamination|spoil\w*|mould\w*|mold\w*|undercooked|raw chicken)\b|受傷|受伤|流血|出血|燒傷|烧伤|火災|火灾|燃氣|燃气|煤氣|煤气|化學|化学|中毒|電擊|电击|食品安全|食物安全|交叉污染|變質|变质|未煮熟/i;
const moneyOrComplaint =
  /\b(refund\w*|payment\w*|cash|till|money|discount\w*|void|transaction\w*|complain\w*|angry|abusive|theft|harass\w*|authoriz\w*|permission\w*)\b|退款|退錢|退钱|付款|支付|現金|现金|收銀|收银|投訴|投诉|客訴|客诉|折扣|騷擾|骚扰|授權|授权/i;
const policyDecision =
  /\b((can|may|should) (i|we)|am i allowed|are we allowed|authoriz\w*|permission)\b|可不可以|可否|能否|是否允許|是否允许|允許|允许|授權|授权/i;
const foodSafetyDecision =
  /\b(food|cake|meal|dish|product|eat|serve)\b.*\b(safe|okay|ok)\b|\b(safe|okay|ok)\b.*\b(food|cake|meal|dish|product|eat|serve)\b|\b(can|may|should) (she|he|they|the customer) eat\b|可.*食用|能.*吃|安全.*食|食.*安全/i;

export function assessRisk(
  message: string,
  knowledge: KnowledgeResult,
): RiskAssessment {
  const hasAllergy = allergy.test(message);
  const hasEmergency = emergency.test(message);
  const hasHazard = hazard.test(message);
  const foodDecision = foodSafetyDecision.test(message);
  const permissionDecision = policyDecision.test(message);
  const needsApproval = moneyOrComplaint.test(message);
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
    reason = hasAllergy
      ? "Possible allergy case; food safety must be verified with the manager."
      : hasEmergency
        ? "Possible immediate danger; follow the workplace emergency procedure."
        : foodDecision
          ? "Food safety cannot be confirmed from a policy match; verify the exact product with the manager."
          : "Possible safety hazard; stop the unsafe activity and get manager help.";
    if (hasEmergency) {
      requiredActions.push(
        "Follow the workplace emergency procedure; contact local emergency services if there is immediate danger.",
        "Alert the manager immediately. Do not delay emergency help while checking documents.",
      );
    }
    if (hasAllergy || foodDecision) {
      requiredActions.push(
        "Do not confirm that the food is safe.",
        "Check the latest allergen information.",
        "Check cross-contamination information.",
        "Ask the manager if safety cannot be verified.",
      );
    } else if (hasHazard) {
      requiredActions.push(
        "Stop the unsafe activity and follow the current workplace safety procedure.",
        "Keep people away from the hazard where it is safe to do so.",
        "Ask the manager to verify the next safe action.",
      );
    }
  } else if (needsApproval) {
    risk = "medium";
    reason =
      "A payment, refund, or difficult customer situation needs company-policy and authority checks.";
    requiredActions.push(
      "Check the current company policy and your authority before making a refund, payment, or exception.",
      "Ask the manager to approve any action you are not authorized to take.",
    );
  }

  if (permissionDecision) {
    requiredActions.push(
      "Check the current procedure and ask the manager to verify your authority before changing it or making an exception.",
    );
    if (risk === "low")
      reason =
        "A policy match does not grant permission. Manager verification is required before making a change.";
  }

  if (missing) {
    requiredActions.push(
      "Ask the manager for the current relevant company policy before taking action.",
    );
    reason += " Current company evidence is missing.";
  } else if (sample) {
    requiredActions.push(
      "Ask the manager to verify the current company policy; the retrieved documents are fictional samples.",
    );
    reason += " Sample documents cannot verify company policy.";
  }

  const escalate = risk !== "low" || missing || sample || permissionDecision;
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
