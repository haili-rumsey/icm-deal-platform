CREATE TYPE "public"."location" AS ENUM('Dallas', 'Houston');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "location" "location";