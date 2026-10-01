import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  BUILDING_CLASSES,
  CATEGORIES,
  COMPANY_TYPES,
  CONFIGURATIONS,
  DEAL_SUBTYPES,
  DEAL_TYPES,
  LOCATIONS,
  OPPORTUNITY_TYPES,
  REPRESENTED,
  SIDES,
  SPRINKLER_TYPES,
  TEAM_ROLES,
  TENANCY,
} from "@/domain/options";
import { users } from "./auth";
import { submarkets } from "./geography";

// ---- Enums (values come from src/domain/options.ts) ----
export const categoryEnum = pgEnum("category", CATEGORIES);
export const dealTypeEnum = pgEnum("deal_type", DEAL_TYPES);
export const dealSubtypeEnum = pgEnum("deal_subtype", DEAL_SUBTYPES);
export const opportunityTypeEnum = pgEnum("opportunity_type", OPPORTUNITY_TYPES);
export const representedEnum = pgEnum("represented", REPRESENTED);
export const tenancyEnum = pgEnum("tenancy", TENANCY);
export const buildingClassEnum = pgEnum("building_class", BUILDING_CLASSES);
export const configurationEnum = pgEnum("configuration", CONFIGURATIONS);
export const sprinklerTypeEnum = pgEnum("sprinkler_type", SPRINKLER_TYPES);
export const companyTypeEnum = pgEnum("company_type", COMPANY_TYPES);
export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const sideEnum = pgEnum("side", SIDES);
export const locationEnum = pgEnum("location", LOCATIONS);

const stamp = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

/** created / last modified, on every entity. */
const tracking = () => ({
  createdAt: stamp("created_at").notNull().defaultNow(),
  createdById: text("created_by_id").references(() => users.id),
  lastModifiedAt: stamp("last_modified_at").notNull().defaultNow(),
  lastModifiedById: text("last_modified_by_id").references(() => users.id),
  // Archive is reversible housekeeping; archived records drop out of lists and pickers.
  archivedAt: stamp("archived_at"),
});

// ---- Company ----
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Institutional owner's real name, never the holding LP/LLC.
    name: text("name").notNull(),
    website: text("website"),
    // Normalized domain (e.g. "blackstone.com") — the duplicate key used in 1.3.
    websiteDomain: text("website_domain"),
    // Explicit "no website" override; flags the record for cleanup.
    noWebsite: boolean("no_website").notNull().default(false),
    types: companyTypeEnum("types").array().notNull().default(sql`'{}'`),
    investmentStrategies: opportunityTypeEnum("investment_strategies").array().notNull().default(sql`'{}'`),
    notes: text("notes"),
    // Companies the system itself relies on: 'stream' and 'private_investors'.
    systemKey: text("system_key").unique(),
    ...tracking(),
  },
  (t) => [index("companies_name_idx").on(t.name), index("companies_domain_idx").on(t.websiteDomain)],
);

// ---- Contact ----
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    title: text("title"),
    // Lowercased. The duplicate key used in 1.3, and how a user is matched to their contact.
    email: text("email"),
    noEmail: boolean("no_email").notNull().default(false),
    phone: text("phone"),
    // On the ICM team roster (admin "ICM team" screen) — the deal team dropdown's source.
    // Independent of app access: some team members never sign in.
    isIcmTeam: boolean("is_icm_team").notNull().default(false),
    // Office (Dallas / Houston) for ICM team members.
    location: locationEnum("location"),
    notes: text("notes"),
    ...tracking(),
  },
  (t) => [
    index("contacts_company_idx").on(t.companyId),
    index("contacts_email_idx").on(t.email),
    index("contacts_name_idx").on(t.lastName, t.firstName),
  ],
);

// ---- Property ----
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    county: text("county"),
    // Picked from the market's list for this city (see geography.ts).
    submarketId: uuid("submarket_id").references(() => submarkets.id),
    buildingDesignation: text("building_designation"),
    // Matching attribute only — Google reissues these, so never a key.
    googlePlaceId: text("google_place_id"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    // False when saved without a Google match; flagged for cleanup.
    addressVerified: boolean("address_verified").notNull().default(false),
    buildingSf: integer("building_sf"),
    acreage: numeric("acreage", { precision: 12, scale: 3 }),
    occupancyPct: numeric("occupancy_pct", { precision: 5, scale: 2 }),
    tenancy: tenancyEnum("tenancy"),
    buildingClass: buildingClassEnum("building_class"),
    yearBuilt: integer("year_built"),
    clearHeightFt: numeric("clear_height_ft", { precision: 6, scale: 2 }),
    configuration: configurationEnum("configuration"),
    dockDoors: integer("dock_doors"),
    officeFinishSf: integer("office_finish_sf"),
    sprinklerType: sprinklerTypeEnum("sprinkler_type"),
    ...tracking(),
  },
  (t) => [index("properties_place_idx").on(t.googlePlaceId), index("properties_city_idx").on(t.state, t.city)],
);

/** Current owner(s). More than one on a JV. Auto-updated on close from 1.4. */
export const propertyOwners = pgTable(
  "property_owners",
  {
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.companyId] })],
);

// ---- Deal ----
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Convention: "Client Name-Deal Name".
    dealName: text("deal_name").notNull(),
    reappsId: text("reapps_id"),
    category: categoryEnum("category"),
    dealType: dealTypeEnum("deal_type"),
    dealSubtype: dealSubtypeEnum("deal_subtype"),
    opportunityType: opportunityTypeEnum("opportunity_type"),
    represented: representedEnum("represented"),
    // IOS desk (sales and leases). Marks the desk, not the asset type.
    isIos: boolean("is_ios").notNull().default(false),
    directAward: boolean("direct_award").notNull().default(false),
    // Stream employee who sent the business — a contact at Stream Realty Partners.
    referralContactId: uuid("referral_contact_id").references(() => contacts.id),
    closingNotes: text("closing_notes"),
    ...tracking(),
  },
  (t) => [index("deals_name_idx").on(t.dealName)],
);

export const dealProperties = pgTable(
  "deal_properties",
  {
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.propertyId] }), index("deal_properties_property_idx").on(t.propertyId)],
);

/** A company (and optionally one of its contacts) on side A or B. Several per side for JVs. */
export const dealParties = pgTable(
  "deal_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    side: sideEnum("side").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    contactId: uuid("contact_id").references(() => contacts.id),
  },
  (t) => [index("deal_parties_deal_idx").on(t.dealId), index("deal_parties_company_idx").on(t.companyId)],
);

/** The single record of who is on a deal. One row per person; several roles allowed. */
export const dealTeam = pgTable(
  "deal_team",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    roles: teamRoleEnum("roles").array().notNull().default(sql`'{}'`),
    isLeadBroker: boolean("is_lead_broker").notNull().default(false),
    isLeadAnalyst: boolean("is_lead_analyst").notNull().default(false),
  },
  (t) => [
    uniqueIndex("deal_team_person_idx").on(t.dealId, t.contactId),
    // One lead analyst per deal.
    uniqueIndex("deal_team_lead_analyst_idx").on(t.dealId).where(sql`${t.isLeadAnalyst}`),
    index("deal_team_contact_idx").on(t.contactId),
  ],
);
