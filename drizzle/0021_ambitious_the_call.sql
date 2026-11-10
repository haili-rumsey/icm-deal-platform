CREATE TYPE "public"."bid_round" AS ENUM('Round 1', 'Round 2', 'Round 3', 'Best & Final');--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"bid_round" "bid_round",
	"bid_amount" numeric(16, 2),
	"bid_date" date,
	"is_verbal" boolean DEFAULT false NOT NULL,
	"toured" boolean DEFAULT false NOT NULL,
	"is_awarded" boolean DEFAULT false NOT NULL,
	"dd_period_days" integer,
	"closing_period_days" integer,
	"initial_em" numeric(16, 2),
	"additional_em" numeric(16, 2),
	"debt_notes" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bids_deal_idx" ON "bids" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "bids_company_idx" ON "bids" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_awarded_idx" ON "bids" USING btree ("deal_id") WHERE "bids"."is_awarded";