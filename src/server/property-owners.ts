import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";
import { dealParties, dealProperties, deals, propertyOwners } from "@/db/schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * A property's current owner is the buyer side of its most recent closed sale.
 * Leases, consulting, referral, equity and debt deals don't change ownership, and a
 * sale with no buyer recorded leaves the owners as they are. Used when a deal moves
 * into Closed and by the historical import.
 */
export async function setOwnersFromLatestSale(db: Db, propertyIds: string[]) {
  for (const propertyId of new Set(propertyIds)) {
    const [latest] = await db
      .select({ id: deals.id })
      .from(dealProperties)
      .innerJoin(deals, eq(deals.id, dealProperties.dealId))
      .where(
        and(
          eq(dealProperties.propertyId, propertyId),
          eq(deals.stage, "Closed"),
          eq(deals.dealType, "Sale"),
          isNull(deals.archivedAt),
        ),
      )
      .orderBy(sql`${deals.closeDate} desc nulls last`, desc(deals.createdAt))
      .limit(1);
    if (!latest) continue;
    const buyers = await db
      .selectDistinct({ companyId: dealParties.companyId })
      .from(dealParties)
      .where(and(eq(dealParties.dealId, latest.id), eq(dealParties.side, "B")));
    if (!buyers.length) continue;
    await db.delete(propertyOwners).where(eq(propertyOwners.propertyId, propertyId));
    await db.insert(propertyOwners).values(buyers.map((b) => ({ propertyId, companyId: b.companyId })));
  }
}

/** After a deal closes: update the owners of each of its properties. */
export async function setOwnersForDeal(db: Db, dealId: string) {
  const rows = await db
    .select({ id: dealProperties.propertyId })
    .from(dealProperties)
    .where(eq(dealProperties.dealId, dealId));
  await setOwnersFromLatestSale(
    db,
    rows.map((r) => r.id),
  );
}
