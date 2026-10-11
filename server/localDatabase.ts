import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createSqliteFaqStore } from "./faq/sqliteStore";

// Local development uses SQLite; hosted requests use the D1 binding instead.
// Apply generated migrations once at startup, never during an API request.
export function openLocalFaqStore() {
  mkdirSync(".data", { recursive: true });
  const database = new DatabaseSync(".data/frontline.sqlite");
  database.exec(
    "CREATE TABLE IF NOT EXISTS local_migrations (tag TEXT PRIMARY KEY NOT NULL)",
  );
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    if (
      database
        .prepare("SELECT tag FROM local_migrations WHERE tag = ?")
        .get(tag)
    )
      continue;
    database.exec("BEGIN");
    try {
      database.exec(readFileSync(`drizzle/${tag}.sql`, "utf8"));
      database
        .prepare("INSERT INTO local_migrations (tag) VALUES (?)")
        .run(tag);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }
  }
  return createSqliteFaqStore(database);
}
