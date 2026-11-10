CREATE TYPE "public"."note_source" AS ENUM('Call', 'Meeting', 'Email', 'Tour', 'Roadshow', 'Internal');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"author_id" uuid,
	"entered_by_id" text,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "note_source",
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by_id" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "bids_one_awarded_idx";--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "fell_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "fell_out_date" date;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "fell_out_note" text;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_contacts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_entered_by_id_users_id_fk" FOREIGN KEY ("entered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_company_idx" ON "notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "notes_deal_idx" ON "notes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "notes_contact_idx" ON "notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "notes_author_idx" ON "notes" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_awarded_idx" ON "bids" USING btree ("deal_id") WHERE "bids"."is_awarded" and not "bids"."fell_out";