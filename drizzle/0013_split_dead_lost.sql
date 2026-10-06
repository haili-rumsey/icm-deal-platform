ALTER TYPE "public"."stage" ADD VALUE 'Dead' BEFORE 'Dead/Lost';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'Lost' BEFORE 'Dead/Lost';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "dead_note" text;