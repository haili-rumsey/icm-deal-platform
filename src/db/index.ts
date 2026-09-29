import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Connections are made per query, so a missing URL only fails when the database is
// actually used — the app still builds before Neon is connected.
const url = process.env.DATABASE_URL;
if (!url) console.warn("DATABASE_URL is not set. See .env.example.");

export const db = drizzle(neon(url ?? "postgresql://not-configured@localhost/none"), { schema });
