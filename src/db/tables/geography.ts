import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Geography is State → City → Submarket. "City" is the address city; each city is
 * mapped (by operations) to a market whose submarket list it uses — Grand Prairie
 * uses the Dallas list. Controlled lists: only admins change them.
 */
export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  state: text("state").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const submarkets = pgTable(
  "submarkets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    // Retired submarkets stay on old properties but aren't offered for new ones.
    retiredAt: timestamp("retired_at", { mode: "date", withTimezone: true }),
  },
  (t) => [uniqueIndex("submarkets_market_name_idx").on(t.marketId, t.name)],
);

/** Which market's submarkets an address city uses. */
export const marketCities = pgTable(
  "market_cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    city: text("city").notNull(),
    state: text("state").notNull(),
  },
  (t) => [uniqueIndex("market_cities_city_idx").on(sql`lower(${t.city})`, t.state)],
);
