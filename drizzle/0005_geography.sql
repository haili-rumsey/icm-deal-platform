CREATE TABLE "market_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "markets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "submarkets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "submarket_id" uuid;--> statement-breakpoint
ALTER TABLE "market_cities" ADD CONSTRAINT "market_cities_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submarkets" ADD CONSTRAINT "submarkets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "market_cities_city_idx" ON "market_cities" USING btree (lower("city"),"state");--> statement-breakpoint
CREATE UNIQUE INDEX "submarkets_market_name_idx" ON "submarkets" USING btree ("market_id","name");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_submarket_id_submarkets_id_fk" FOREIGN KEY ("submarket_id") REFERENCES "public"."submarkets"("id") ON DELETE no action ON UPDATE no action;