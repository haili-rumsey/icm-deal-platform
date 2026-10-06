-- Deals in the old combined stage: one that came from a pitch (pitch marked Lost) is Lost,
-- anything else is Dead. Its own migration: new enum values can't be used in the
-- transaction that adds them.
UPDATE "deals" SET "stage" = CASE WHEN "pitch_status" = 'Lost' THEN 'Lost'::"stage" ELSE 'Dead'::"stage" END
WHERE "stage" = 'Dead/Lost';
