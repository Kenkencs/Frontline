import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// One durable queue: pending questions become reusable FAQ records after review.
export const faqQuestions = sqliteTable("faq_questions", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  employee_role: text("employee_role").notNull(),
  status: text("status").notNull(),
  answer: text("answer"),
  category: text("category"),
  source_reference: text("source_reference"),
  created_at: text("created_at").notNull(),
  published_at: text("published_at"),
  review_by: text("review_by"),
});
