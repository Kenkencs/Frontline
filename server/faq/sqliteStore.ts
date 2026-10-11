import type { DatabaseSync } from "node:sqlite";
import { SqlFaqStore, type FaqStore } from "./store";

// Local startup applies the migration before passing its open database here.
// This Node-only adapter is never imported by the hosted Worker.
export function createSqliteFaqStore(database: DatabaseSync): FaqStore {
  return new SqlFaqStore({
    async all(sql, values) {
      return database.prepare(sql).all(...values);
    },
    async run(sql, values) {
      return Number(database.prepare(sql).run(...values).changes);
    },
  });
}
