import type { EmployeeRole } from "../../shared/chat";
import {
  isQuestionRecord,
  parseReviewQuestion,
  parseSubmitQuestion,
  type PublishQuestion,
  type QuestionRecord,
  type QuestionStatus,
  type SubmitQuestion,
} from "../../shared/faq";

export interface FaqStore {
  list(role?: EmployeeRole, status?: QuestionStatus): Promise<QuestionRecord[]>;
  submit(input: SubmitQuestion, now?: Date): Promise<QuestionRecord>;
  publish(
    id: string,
    input: PublishQuestion,
    now?: Date,
  ): Promise<QuestionRecord>;
  reject(id: string): Promise<QuestionRecord>;
}

export class FaqStoreError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unavailableStore = () =>
  new FaqStoreError(
    503,
    "Question storage is unavailable. Ask the manager directly and try saving again when storage is configured.",
  );

// Both adapters use these prepared SQL statements. Neither creates tables in a request.
export interface FaqSqlDriver {
  all(sql: string, values: (string | null)[]): Promise<unknown[]>;
  run(sql: string, values: (string | null)[]): Promise<number>;
}
const columns =
  "id, question, employee_role, status, answer, category, source_reference, created_at, published_at, review_by";

function record(value: unknown): QuestionRecord {
  if (!isQuestionRecord(value)) throw unavailableStore();
  // Return known fields only, never arbitrary database metadata.
  return {
    id: value.id,
    question: value.question,
    employee_role: value.employee_role,
    status: value.status,
    answer: value.answer,
    category: value.category,
    source_reference: value.source_reference,
    created_at: value.created_at,
    published_at: value.published_at,
    review_by: value.review_by,
  };
}

export class SqlFaqStore implements FaqStore {
  constructor(private readonly driver: FaqSqlDriver) {}

  async list(
    role?: EmployeeRole,
    status?: QuestionStatus,
  ): Promise<QuestionRecord[]> {
    const conditions: string[] = [];
    const values: string[] = [];
    if (role) {
      conditions.push("employee_role = ?");
      values.push(role);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    // Review the oldest pending entries first. Published FAQs favor recent entries.
    const order = status === "pending" ? "ASC" : "DESC";
    return (
      await this.driver.all(
        `SELECT ${columns} FROM faq_questions${where} ORDER BY created_at ${order}, id ASC LIMIT 500`,
        values,
      )
    ).map(record);
  }

  async submit(
    input: SubmitQuestion,
    now = new Date(),
  ): Promise<QuestionRecord> {
    const parsed = parseSubmitQuestion(input);
    const question: QuestionRecord = {
      id: crypto.randomUUID(),
      ...parsed,
      status: "pending",
      answer: null,
      category: null,
      source_reference: null,
      created_at: now.toISOString(),
      published_at: null,
      review_by: null,
    };
    const changes = await this.driver.run(
      `INSERT INTO faq_questions (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        question.id,
        question.question,
        question.employee_role,
        question.status,
        null,
        null,
        null,
        question.created_at,
        null,
        null,
      ],
    );
    if (changes !== 1) throw unavailableStore();
    return question;
  }

  private async get(id: string): Promise<QuestionRecord | undefined> {
    const rows = await this.driver.all(
      `SELECT ${columns} FROM faq_questions WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows.length ? record(rows[0]) : undefined;
  }

  private async reviewed(id: string, changes: number): Promise<QuestionRecord> {
    const question = await this.get(id);
    if (!question) throw new FaqStoreError(404, "Question not found.");
    if (changes === 0)
      throw new FaqStoreError(
        409,
        "This question has already been reviewed. Refresh the queue.",
      );
    if (changes !== 1) throw unavailableStore();
    return question;
  }

  async publish(
    id: string,
    input: PublishQuestion,
    now = new Date(),
  ): Promise<QuestionRecord> {
    const parsed = parseReviewQuestion({ ...input, action: "publish" }, now);
    if (parsed.action !== "publish") throw new Error("Invalid review action");
    const changes = await this.driver.run(
      "UPDATE faq_questions SET status = 'published', answer = ?, category = ?, source_reference = ?, published_at = ?, review_by = ? WHERE id = ? AND status = 'pending'",
      [
        parsed.answer,
        parsed.category,
        parsed.source_reference,
        now.toISOString(),
        parsed.review_by,
        id,
      ],
    );
    return this.reviewed(id, changes);
  }

  async reject(id: string): Promise<QuestionRecord> {
    const changes = await this.driver.run(
      "UPDATE faq_questions SET status = 'rejected' WHERE id = ? AND status = 'pending'",
      [id],
    );
    return this.reviewed(id, changes);
  }
}

// Structural D1 types keep this module portable without a Cloudflare dependency.
export interface FaqD1Database {
  prepare(sql: string): {
    bind(...values: (string | null)[]): {
      all<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
      run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
    };
  };
}

export function createD1FaqStore(database: FaqD1Database): FaqStore {
  return new SqlFaqStore({
    async all(sql, values) {
      const result = await database
        .prepare(sql)
        .bind(...values)
        .all();
      if (!result.success || !Array.isArray(result.results))
        throw unavailableStore();
      return result.results;
    },
    async run(sql, values) {
      const result = await database
        .prepare(sql)
        .bind(...values)
        .run();
      if (!result.success || !Number.isInteger(result.meta?.changes))
        throw unavailableStore();
      return result.meta!.changes!;
    },
  });
}
