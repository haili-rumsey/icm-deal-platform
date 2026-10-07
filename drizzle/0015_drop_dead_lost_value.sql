ALTER TABLE "deals" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "stage" SET DEFAULT 'BOV 1'::text;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "furthest_stage" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."stage";--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('BOV 1', 'BOV 2', 'Engaged', 'Marketing', 'Awarded', 'Under Contract', 'Closed', 'Track', 'Dead', 'Lost');--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "stage" SET DEFAULT 'BOV 1'::"public"."stage";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "stage" SET DATA TYPE "public"."stage" USING "stage"::"public"."stage";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "furthest_stage" SET DATA TYPE "public"."stage" USING "furthest_stage"::"public"."stage";