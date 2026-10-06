import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

/** Each person's chosen columns for a list or report, keyed by list (e.g. "deals-closed"). */
export const listLayouts = pgTable(
  "list_layouts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listKey: text("list_key").notNull(),
    // Visible column keys, in display order.
    columns: text("columns").array().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listKey] })],
);
