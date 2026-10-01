import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketCities, markets, properties, submarkets } from "@/db/schema";

export type GeoMarket = { id: string; name: string; state: string; submarkets: { id: string; name: string }[] };
/** What the property form needs to offer the right submarkets for whatever city is entered. */
export type GeoLookup = { markets: GeoMarket[]; cityToMarket: Record<string, string> };

export function cityKey(city: string, state: string) {
  return `${city.trim().toLowerCase()}|${state.trim().toUpperCase()}`;
}

/**
 * Active submarkets per market, plus the city → market list. `keepSubmarketId`
 * keeps a retired submarket in the list when it's the one already on a property.
 */
export async function geoLookup(keepSubmarketId?: string | null): Promise<GeoLookup> {
  const [marketRows, subRows, cityRows] = await Promise.all([
    db.select().from(markets).orderBy(asc(markets.sortOrder), asc(markets.name)),
    db
      .select({ id: submarkets.id, marketId: submarkets.marketId, name: submarkets.name, retiredAt: submarkets.retiredAt })
      .from(submarkets)
      .orderBy(asc(submarkets.sortOrder), asc(submarkets.name)),
    db.select({ marketId: marketCities.marketId, city: marketCities.city, state: marketCities.state }).from(marketCities),
  ]);
  return {
    markets: marketRows.map((m) => ({
      id: m.id,
      name: m.name,
      state: m.state,
      submarkets: subRows
        .filter((s) => s.marketId === m.id && (!s.retiredAt || s.id === keepSubmarketId))
        .map((s) => ({ id: s.id, name: s.name })),
    })),
    cityToMarket: Object.fromEntries(cityRows.map((c) => [cityKey(c.city, c.state), c.marketId])),
  };
}

/** Submarket names for display, keyed by id. */
export async function submarketName(id: string | null) {
  if (!id) return null;
  const [row] = await db
    .select({ name: submarkets.name, market: markets.name })
    .from(submarkets)
    .innerJoin(markets, eq(markets.id, submarkets.marketId))
    .where(eq(submarkets.id, id));
  return row ?? null;
}

// ---- Admin: the Geography screen ----

export async function listGeography() {
  const [marketRows, subRows, cityRows, unmapped] = await Promise.all([
    db.select().from(markets).orderBy(asc(markets.sortOrder), asc(markets.name)),
    db
      .select({
        id: submarkets.id,
        marketId: submarkets.marketId,
        name: submarkets.name,
        retiredAt: submarkets.retiredAt,
        propertyCount: sql<number>`(select count(*)::int from properties p where p.submarket_id = "submarkets"."id")`,
      })
      .from(submarkets)
      .orderBy(asc(submarkets.sortOrder), asc(submarkets.name)),
    db
      .select({ id: marketCities.id, marketId: marketCities.marketId, city: marketCities.city, state: marketCities.state })
      .from(marketCities)
      .orderBy(asc(marketCities.city)),
    // Cities on properties that aren't on any market's list yet.
    db
      .selectDistinct({ city: properties.city, state: properties.state })
      .from(properties)
      .where(
        and(
          isNull(properties.archivedAt),
          sql`${properties.city} is not null`,
          sql`not exists (select 1 from market_cities mc where lower(mc.city) = lower(${properties.city}) and mc.state = ${properties.state})`,
        ),
      )
      .orderBy(asc(properties.city)),
  ]);
  return {
    markets: marketRows.map((m) => ({
      ...m,
      submarkets: subRows.filter((s) => s.marketId === m.id),
      cities: cityRows.filter((c) => c.marketId === m.id),
    })),
    unmappedCities: unmapped.filter((u): u is { city: string; state: string } => !!u.city && !!u.state),
  };
}

export type GeoResult = { ok: true } | { ok: false; message: string };

export async function addCity(marketId: string, city: string, state: string): Promise<GeoResult> {
  const name = city.trim();
  if (!name) return { ok: false, message: "Enter a city." };
  const [taken] = await db
    .select({ market: markets.name })
    .from(marketCities)
    .innerJoin(markets, eq(markets.id, marketCities.marketId))
    .where(and(sql`lower(${marketCities.city}) = lower(${name})`, eq(marketCities.state, state)));
  if (taken) return { ok: false, message: `${name} is already on the ${taken.market} list.` };
  await db.insert(marketCities).values({ marketId, city: name, state });
  return { ok: true };
}

export async function removeCity(id: string) {
  await db.delete(marketCities).where(eq(marketCities.id, id));
}

export async function addSubmarket(marketId: string, name: string): Promise<GeoResult> {
  const n = name.trim();
  if (!n) return { ok: false, message: "Enter a submarket name." };
  const [taken] = await db
    .select({ id: submarkets.id })
    .from(submarkets)
    .where(and(eq(submarkets.marketId, marketId), sql`lower(${submarkets.name}) = lower(${n})`));
  if (taken) return { ok: false, message: `${n} is already on this list.` };
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${submarkets.sortOrder}), -1)::int` })
    .from(submarkets)
    .where(eq(submarkets.marketId, marketId));
  await db.insert(submarkets).values({ marketId, name: n, sortOrder: max + 1 });
  return { ok: true };
}

/** Retired submarkets stay on the properties that have them but aren't offered for new ones. */
export async function setSubmarketRetired(id: string, retired: boolean) {
  await db.update(submarkets).set({ retiredAt: retired ? new Date() : null }).where(eq(submarkets.id, id));
}
