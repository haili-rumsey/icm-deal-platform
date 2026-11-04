CREATE TYPE "public"."deal_link_kind" AS ENUM('Broken out', 'Combined');--> statement-breakpoint
CREATE TABLE "deal_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "deal_link_kind" NOT NULL,
	"from_deal_id" uuid NOT NULL,
	"to_deal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text
);
--> statement-breakpoint
ALTER TABLE "deal_links" ADD CONSTRAINT "deal_links_from_deal_id_deals_id_fk" FOREIGN KEY ("from_deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_links" ADD CONSTRAINT "deal_links_to_deal_id_deals_id_fk" FOREIGN KEY ("to_deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_links" ADD CONSTRAINT "deal_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_links_from_idx" ON "deal_links" USING btree ("from_deal_id");--> statement-breakpoint
CREATE INDEX "deal_links_to_idx" ON "deal_links" USING btree ("to_deal_id");