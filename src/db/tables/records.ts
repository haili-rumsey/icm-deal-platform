import {
  boolean,
  date,
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
  PITCH_STATUSES,
  REPRESENTED,
  SIDES,
  SPRINKLER_TYPES,
  STAGES,
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
export const stageEnum = pgEnum("stage", STAGES);
export const pitchStatusEnum = pgEnum("pitch_status", PITCH_STATUSES);

const stamp = (name: string) => timestamp(name, { mode: "date", withTimezone: true });
const money = (name: string) => numeric(name, { precision: 16, scale: 2 });
/** Percentages stored as written, e.g. 5.25 for 5.25%. */
const pct = (name: string) => numeric(name, { precision: 7, scale: 4 });

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

    // ---- Stage and dates (PRD §1, §3). Dates overwrite; there is no date history. ----
    stage: stageEnum("stage").notNull().default("BOV 1"),
    pitchDate: date("pitch_date"),
    pitchStatus: pitchStatusEnum("pitch_status"),
    lostToCompanyId: uuid("lost_to_company_id").references(() => companies.id),
    lostNote: text("lost_note"),
    wonDate: date("won_date"),
    launchDate: date("launch_date"),
    callForOffersDate: date("call_for_offers_date"),
    awardedDate: date("awarded_date"),
    ddExpirationDate: date("dd_expiration_date"),
    closeDate: date("close_date"),

    // ---- Three independent financial blocks. They never overwrite each other. ----
    // BOV — overwritten in place on repricing.
    bovPriceLow: money("bov_price_low"),
    bovPriceMid: money("bov_price_mid"),
    bovPriceHigh: money("bov_price_high"),
    bovYear1Cap: pct("bov_year1_cap"),
    bovUlirr: pct("bov_ulirr"),
    bovLirr: pct("bov_lirr"),
    bovExitCap: pct("bov_exit_cap"),
    bovHoldYears: numeric("bov_hold_years", { precision: 5, scale: 2 }),
    // OM / Guidance — guidance_price is internal only, never in client-facing output.
    guidancePrice: money("guidance_price"),
    omYear1Cap: pct("om_year1_cap"),
    omUlirr: pct("om_ulirr"),
    omLirr: pct("om_lirr"),
    omExitCap: pct("om_exit_cap"),
    omHoldYears: numeric("om_hold_years", { precision: 5, scale: 2 }),
    // Closed — as transacted.
    contractPrice: money("contract_price"),
    closedPrice: money("closed_price"),
    closedYear1Cap: pct("closed_year1_cap"),
    closedUlirr: pct("closed_ulirr"),
    closedLirr: pct("closed_lirr"),
    closedExitCap: pct("closed_exit_cap"),
    closedHoldYears: numeric("closed_hold_years", { precision: 5, scale: 2 }),
    priceNotes: text("price_notes"),

    // ---- Headline figures for non-sale deal types (PRD §2). ----
    totalCapitalization: money("total_capitalization"),
    loanAmount: money("loan_amount"),
    interestRate: pct("interest_rate"),
    loanTermYears: numeric("loan_term_years", { precision: 5, scale: 2 }),
    ltv: pct("ltv"),
    totalLeaseConsideration: money("total_lease_consideration"),

    // ---- Fee — mirrors accounting. ----
    totalCommission: money("total_commission"),
    outsideCommission: money("outside_commission"),
    outsideCommissionNote: text("outside_commission_note"),
    // Defaults to total − outside; once typed over, the typed figure is kept.
    inHouseGross: money("in_house_gross"),
    inHouseGrossManual: boolean("in_house_gross_manual").notNull().default(false),
    feeRate: pct("fee_rate"),
    // Why the fee % is what it is (e.g. reduced at award) — builds a fee history across deals.
    feeNotes: text("fee_notes"),

    ...tracking(),
  },
  (t) => [index("deals_name_idx").on(t.dealName), index("deals_stage_idx").on(t.stage)],
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
