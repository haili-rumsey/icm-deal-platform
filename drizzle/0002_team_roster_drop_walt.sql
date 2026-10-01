ALTER TABLE "contacts" ADD COLUMN "is_icm_team" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "walt_years";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "walt_as_of";--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "occupancy_as_of";