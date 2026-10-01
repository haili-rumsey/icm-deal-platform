CREATE TYPE "public"."pitch_status" AS ENUM('Won', 'Lost');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('BOV 1', 'BOV 2', 'Engaged', 'Marketing', 'Awarded', 'Under Contract', 'Closed', 'Track', 'Dead/Lost');--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stage" "stage" DEFAULT 'BOV 1' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pitch_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pitch_status" "pitch_status";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_to_company_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_note" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "won_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "launch_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "call_for_offers_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "awarded_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "dd_expiration_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "close_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_price_low" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_price_mid" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_price_high" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_year1_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_ulirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_lirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_exit_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "bov_hold_years" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "guidance_price" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "om_year1_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "om_ulirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "om_lirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "om_exit_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "om_hold_years" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "contract_price" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_price" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_year1_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_ulirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_lirr" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_exit_cap" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_hold_years" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "price_notes" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "total_capitalization" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "loan_amount" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "interest_rate" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "loan_term_years" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "ltv" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "total_lease_consideration" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "total_commission" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "outside_commission" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "outside_commission_note" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "in_house_gross" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "in_house_gross_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "fee_rate" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lost_to_company_id_companies_id_fk" FOREIGN KEY ("lost_to_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");