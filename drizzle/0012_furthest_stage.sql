ALTER TABLE "deals" ADD COLUMN "furthest_stage" "stage";--> statement-breakpoint
-- Existing deals: as far as they've got is where they are (all 120 are closed today).
UPDATE "deals" SET "furthest_stage" = "stage" WHERE "stage" NOT IN ('Track', 'Dead/Lost');
