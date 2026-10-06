CREATE TABLE "list_layouts" (
	"user_id" text NOT NULL,
	"list_key" text NOT NULL,
	"columns" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_layouts_user_id_list_key_pk" PRIMARY KEY("user_id","list_key")
);
--> statement-breakpoint
ALTER TABLE "list_layouts" ADD CONSTRAINT "list_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;