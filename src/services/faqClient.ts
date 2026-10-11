import type { EmployeeRole } from "../../shared/chat";
import { roles } from "../../shared/catalog";
import {
  isQuestionRecord,
  isUtcDate,
  parseReviewAction,
  parseSubmitQuestion,
  type FaqCatalog,
  type QuestionRecord,
  type QuestionStatus,
  type ReviewAction,
  type SubmitQuestion,
} from "../../shared/faq";
import { isRecord, isSource } from "../../shared/validation";

const uncertainWrite =
  "Could not confirm that this change was saved. Refresh question review before trying again.";

// Same-origin backend calls only. A write is successful only after a valid server receipt.
async function requestJson(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 10_000);
  const writing = init.method === "POST";
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409)
        throw new Error(
          "This question has already been reviewed. Refresh the list.",
        );
      if (response.status === 403)
        throw new Error(
          "The request was blocked. Reopen this application and try again.",
        );
      if (response.status === 503)
        throw new Error(
          "Question storage is unavailable. Ask the project owner to configure the backend.",
        );
      if (response.status === 400 || response.status === 404)
        throw new Error(
          isRecord(value) &&
            typeof value.error === "string" &&
            value.error.length <= 300
            ? value.error
            : "The request was not accepted. Check the form and try again.",
        );
      throw new Error(
        writing
          ? uncertainWrite
          : "Could not load the FAQ workspace. Please retry.",
      );
    }
    if (value === null)
      throw new Error(
        writing
          ? uncertainWrite
          : "The server did not return a valid FAQ response.",
      );
    return value;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        writing ? uncertainWrite : "Loading timed out. Please retry.",
      );
    if (error instanceof TypeError)
      throw new Error(
        writing ? uncertainWrite : "Cannot reach the backend. Please retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function getFaq(
  role: EmployeeRole,
  signal?: AbortSignal,
): Promise<FaqCatalog> {
  if (!roles.some((item) => item.id === role))
    throw new Error("Choose a supported employee role.");
  const value = await requestJson(
    `/api/faq?employee_role=${encodeURIComponent(role)}`,
    {},
    signal,
  );
  if (
    !isRecord(value) ||
    !["none", "sample", "company"].includes(String(value.mode)) ||
    !Array.isArray(value.faqs) ||
    !value.faqs.every(
      (item) =>
        isRecord(item) &&
        ["id", "question", "answer", "category", "source_reference"].every(
          (field) => typeof item[field] === "string" && !!item[field].trim(),
        ) &&
        isUtcDate(item.review_by) &&
        isSource(item.source) &&
        typeof item.source.sample === "boolean",
    )
  )
    throw new Error("The server returned an invalid FAQ catalog.");
  return value as unknown as FaqCatalog;
}

export async function getQuestions(
  status: QuestionStatus = "pending",
  signal?: AbortSignal,
): Promise<QuestionRecord[]> {
  if (!["pending", "published", "rejected"].includes(status))
    throw new Error("Choose a supported question status.");
  const value = await requestJson(
    `/api/questions?status=${encodeURIComponent(status)}`,
    {},
    signal,
  );
  if (
    !isRecord(value) ||
    !Array.isArray(value.questions) ||
    !value.questions.every(
      (item) => isQuestionRecord(item) && item.status === status,
    )
  )
    throw new Error("The server returned an invalid question list.");
  return value.questions;
}

export async function submitQuestion(
  input: SubmitQuestion,
  signal?: AbortSignal,
): Promise<QuestionRecord> {
  const request = parseSubmitQuestion(input);
  const value = await requestJson(
    "/api/questions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    signal,
  );
  if (
    !isRecord(value) ||
    !isQuestionRecord(value.question) ||
    value.question.status !== "pending" ||
    value.question.question !== request.question ||
    value.question.employee_role !== request.employee_role
  )
    throw new Error(uncertainWrite);
  return value.question;
}

export async function reviewQuestion(
  id: string,
  input: ReviewAction,
  signal?: AbortSignal,
): Promise<QuestionRecord> {
  if (!id.trim()) throw new Error("Choose a question to review.");
  const request = parseReviewAction(input);
  const value = await requestJson(
    `/api/questions/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    signal,
  );
  const record = isRecord(value) ? value.question : null;
  if (
    !isQuestionRecord(record) ||
    record.id !== id ||
    record.status !==
      (request.action === "publish" ? "published" : "rejected") ||
    (request.action === "publish" &&
      ["answer", "category", "source_reference", "review_by"].some(
        (field) =>
          record[field as keyof QuestionRecord] !==
          request[field as keyof typeof request],
      ))
  )
    throw new Error(uncertainWrite);
  return record;
}
