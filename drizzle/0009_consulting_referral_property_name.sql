ALTER TYPE "public"."deal_type" ADD VALUE 'Consulting';--> statement-breakpoint
ALTER TYPE "public"."deal_type" ADD VALUE 'Referral';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "name" text;