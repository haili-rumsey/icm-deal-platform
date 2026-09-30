import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, deals, properties } from "@/db/schema";

export const ENTITIES = { deal: deals, property: properties, company: companies, contact: contacts } as const;
export type EntityKind = keyof typeof ENTITIES;

export function isEntityKind(v: string): v is EntityKind {
  return v in ENTITIES;
}

/** Archive is reversible housekeeping, open to any user. */
export async function setArchived(kind: EntityKind, id: string, archived: boolean, byId: string) {
  const table = ENTITIES[kind];
  await db
    .update(table)
    .set({ archivedAt: archived ? new Date() : null, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(table.id, id));
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

/**
 * Permanent delete, for records created in error. Callers must check the user is one
 * of the three admins. Refuses (rather than cascading) when other records still point
 * at this one, so a mistaken delete can't take history with it.
 */
export async function deleteRecord(kind: EntityKind, id: string): Promise<DeleteResult> {
  const table = ENTITIES[kind];
  try {
    await db.delete(table).where(eq(table.id, id));
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23503") {
      return {
        ok: false,
        message: "This record is still linked to other records (deals, contacts or properties). Remove those links first, or archive it instead.",
      };
    }
    throw e;
  }
}
