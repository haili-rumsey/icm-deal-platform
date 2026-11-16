CREATE TABLE "change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text,
	"by_user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"detail" text
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_occurred_idx" ON "change_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "change_log_record_idx" ON "change_log" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "job_runs_started_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
-- Change-log triggers (hand-written, not part of the schema snapshot): the database writes a
-- change_log row whenever a record is created or a deal's stage changes, from any code path.
CREATE FUNCTION log_record_created() RETURNS trigger AS $$
BEGIN
  INSERT INTO change_log (kind, record_type, record_id, by_user_id)
  VALUES ('created', TG_ARGV[0], NEW.id, NEW.created_by_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE FUNCTION log_deal_stage_change() RETURNS trigger AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO change_log (kind, record_type, record_id, from_stage, to_stage, by_user_id)
    VALUES ('stage_change', 'deal', NEW.id, OLD.stage::text, NEW.stage::text, NEW.last_modified_by_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER deals_log_created AFTER INSERT ON deals FOR EACH ROW EXECUTE FUNCTION log_record_created('deal');--> statement-breakpoint
CREATE TRIGGER properties_log_created AFTER INSERT ON properties FOR EACH ROW EXECUTE FUNCTION log_record_created('property');--> statement-breakpoint
CREATE TRIGGER companies_log_created AFTER INSERT ON companies FOR EACH ROW EXECUTE FUNCTION log_record_created('company');--> statement-breakpoint
CREATE TRIGGER contacts_log_created AFTER INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION log_record_created('contact');--> statement-breakpoint
CREATE TRIGGER deals_log_stage AFTER UPDATE OF stage ON deals FOR EACH ROW EXECUTE FUNCTION log_deal_stage_change();
