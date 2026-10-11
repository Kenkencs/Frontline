import type { EmployeeRole, Source } from "./chat";
import { roles } from "./catalog";
import { isRecord } from "./validation";

export type QuestionStatus = "pending" | "published" | "rejected";

// These names match the single FAQ database table and API JSON.
export interface QuestionRecord {
  id: string;
  question: string;
  employee_role: EmployeeRole;
  status: QuestionStatus;
  answer: string | null;
  category: string | null;
  source_reference: string | null;
  created_at: string;
  published_at: string | null;
  review_by: string | null;
}

export interface SubmitQuestion {
  question: string;
  employee_role: EmployeeRole;
}

export interface PublishQuestion {
  answer: string;
  category: string;
  source_reference: string;
  review_by: string; // A future YYYY-MM-DD date, within the next 365 days.
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  source_reference: string;
  review_by: string;
  source: Source;
}

export interface FaqCatalog {
  faqs: FaqItem[];
  mode: "none" | "sample" | "company";
}

export interface QuestionList {
  questions: QuestionRecord[];
}
export interface QuestionResult {
  question: QuestionRecord;
}

export type ReviewQuestion =
  ({ action: "publish" } & PublishQuestion) | { action: "reject" };
export type ReviewAction = ReviewQuestion;

function requiredText(value: unknown, label: string, limit: number): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Enter ${label}.`);
  if (value.length > limit)
    throw new Error(`Keep ${label} within ${limit} characters.`);
  return value.trim();
}

export function parseSubmitQuestion(value: unknown): SubmitQuestion {
  if (!isRecord(value)) throw new Error("Send a question and employee role.");
  const role = roles.find((item) => item.id === value.employee_role);
  if (!role) throw new Error("Choose a supported employee role.");
  return {
    question: requiredText(value.question, "a question", 1000),
    employee_role: role.id,
  };
}

export function isUtcDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function parseReviewQuestion(
  value: unknown,
  now = new Date(),
): ReviewQuestion {
  if (!isRecord(value)) throw new Error("Choose publish or reject.");
  if (value.action === "reject") return { action: "reject" };
  if (value.action !== "publish") throw new Error("Choose publish or reject.");
  if (!Number.isFinite(now.getTime()))
    throw new Error("Could not check the review date.");
  const today = now.toISOString().slice(0, 10);
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 365);
  if (
    !isUtcDate(value.review_by) ||
    value.review_by <= today ||
    value.review_by > latest.toISOString().slice(0, 10)
  )
    throw new Error(
      "Choose a valid future review date within the next 365 days.",
    );
  return {
    action: "publish",
    answer: requiredText(value.answer, "an answer", 4000),
    category: requiredText(value.category, "a category", 60),
    source_reference: requiredText(
      value.source_reference,
      "a source reference",
      200,
    ),
    review_by: value.review_by,
  };
}
export const parseReviewAction = parseReviewQuestion;

// Response validation protects clients from malformed or partial success bodies.
export function isQuestionRecord(value: unknown): value is QuestionRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.question !== "string" ||
    !value.question.trim() ||
    value.question.length > 1000 ||
    !roles.some((role) => role.id === value.employee_role) ||
    !["pending", "published", "rejected"].includes(String(value.status)) ||
    typeof value.created_at !== "string" ||
    !Number.isFinite(Date.parse(value.created_at))
  )
    return false;
  const fields = [
    "answer",
    "category",
    "source_reference",
    "published_at",
    "review_by",
  ];
  if (
    !fields.every(
      (field) => value[field] === null || typeof value[field] === "string",
    )
  )
    return false;
  if (value.status !== "published")
    return fields.every((field) => value[field] === null);
  return (
    typeof value.answer === "string" &&
    !!value.answer.trim() &&
    value.answer.length <= 4000 &&
    typeof value.category === "string" &&
    !!value.category.trim() &&
    value.category.length <= 60 &&
    typeof value.source_reference === "string" &&
    !!value.source_reference.trim() &&
    value.source_reference.length <= 200 &&
    typeof value.published_at === "string" &&
    Number.isFinite(Date.parse(value.published_at)) &&
    isUtcDate(value.review_by)
  );
}
