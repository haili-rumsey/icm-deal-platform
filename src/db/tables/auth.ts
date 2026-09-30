import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const stamp = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

/**
 * People who can sign in. `name`, `email`, `emailVerified` and `image` are the
 * shape Auth.js expects; the rest is ours. Users are never deleted — deactivate
 * instead, so their history stays attached.
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: stamp("email_verified"),
  image: text("image"),
  // The three named users: user admin, delete, closed-deal unlock. Seeded, not editable in the UI.
  isAdmin: boolean("is_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: stamp("created_at").notNull().defaultNow(),
  createdById: text("created_by_id").references((): AnyPgColumn => users.id),
  lastModifiedAt: stamp("last_modified_at").notNull().defaultNow(),
  lastModifiedById: text("last_modified_by_id").references((): AnyPgColumn => users.id),
});

// ---- Auth.js tables (required by the adapter; only src/auth/ touches these) ----

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"email" | "oauth" | "oidc" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
