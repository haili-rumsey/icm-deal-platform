CREATE TYPE "public"."building_class" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('Industrial', 'Office', 'Retail', 'IOS', 'Land', 'Mixed');--> statement-breakpoint
CREATE TYPE "public"."company_type" AS ENUM('Investor', 'Developer', 'Owner-user', 'Lender', 'Brokerage');--> statement-breakpoint
CREATE TYPE "public"."configuration" AS ENUM('Rear-load', 'Front-load', 'Cross-dock', 'Shallow bay', 'IOS');--> statement-breakpoint
CREATE TYPE "public"."deal_subtype" AS ENUM('Investment Sale', 'Forward Sale', 'NNN', 'Portfolio', 'JV', 'Senior Financing');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('Sale', 'Equity', 'Debt', 'Lease');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('Core', 'Core Plus', 'Value Add', 'Opportunistic', 'Development');--> statement-breakpoint
CREATE TYPE "public"."represented" AS ENUM('Seller/Landlord', 'Buyer/Tenant', 'Both');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."sprinkler_type" AS ENUM('ESFR', 'Wet', 'Dry', 'Dry with in-rack', 'None');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('Producer', 'Analyst', 'Operations', 'Designer', 'Leasing');--> statement-breakpoint
CREATE TYPE "public"."tenancy" AS ENUM('Single', 'Multi');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"website_domain" text,
	"no_website" boolean DEFAULT false NOT NULL,
	"types" "company_type"[] DEFAULT '{}' NOT NULL,
	"investment_strategies" "opportunity_type"[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"system_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "companies_system_key_unique" UNIQUE("system_key")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text,
	"email" text,
	"no_email" boolean DEFAULT false NOT NULL,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deal_properties" (
	"deal_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"allocated_price" numeric(16, 2),
	CONSTRAINT "deal_properties_deal_id_property_id_pk" PRIMARY KEY("deal_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "deal_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"roles" "team_role"[] DEFAULT '{}' NOT NULL,
	"is_lead_broker" boolean DEFAULT false NOT NULL,
	"is_lead_analyst" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_name" text NOT NULL,
	"reapps_id" text,
	"category" "category",
	"deal_type" "deal_type",
	"deal_subtype" "deal_subtype",
	"opportunity_type" "opportunity_type",
	"represented" "represented",
	"is_ios" boolean DEFAULT false NOT NULL,
	"direct_award" boolean DEFAULT false NOT NULL,
	"walt_years" numeric(5, 2),
	"walt_as_of" date,
	"referral_contact_id" uuid,
	"closing_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"building_designation" text,
	"google_place_id" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"address_verified" boolean DEFAULT false NOT NULL,
	"building_sf" integer,
	"acreage" numeric(12, 3),
	"occupancy_pct" numeric(5, 2),
	"occupancy_as_of" date,
	"tenancy" "tenancy",
	"building_class" "building_class",
	"year_built" integer,
	"clear_height_ft" numeric(6, 2),
	"configuration" "configuration",
	"dock_doors" integer,
	"office_finish_sf" integer,
	"sprinkler_type" "sprinkler_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "property_owners" (
	"property_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "property_owners_property_id_company_id_pk" PRIMARY KEY("property_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_properties" ADD CONSTRAINT "deal_properties_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_properties" ADD CONSTRAINT "deal_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_team" ADD CONSTRAINT "deal_team_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_team" ADD CONSTRAINT "deal_team_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_referral_contact_id_contacts_id_fk" FOREIGN KEY ("referral_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" USING btree ("website_domain");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "deal_parties_deal_idx" ON "deal_parties" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_parties_company_idx" ON "deal_parties" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "deal_properties_property_idx" ON "deal_properties" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_team_person_idx" ON "deal_team" USING btree ("deal_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_team_lead_analyst_idx" ON "deal_team" USING btree ("deal_id") WHERE "deal_team"."is_lead_analyst";--> statement-breakpoint
CREATE INDEX "deal_team_contact_idx" ON "deal_team" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deals_name_idx" ON "deals" USING btree ("deal_name");--> statement-breakpoint
CREATE INDEX "properties_place_idx" ON "properties" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "properties_city_idx" ON "properties" USING btree ("state","city");