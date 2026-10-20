CREATE TABLE "ingestion_sources" (
	"name" text PRIMARY KEY NOT NULL,
	"last_version" text,
	"last_run_at" timestamp,
	"last_status" text,
	"last_error" text,
	"last_fetched" integer DEFAULT 0 NOT NULL,
	"last_queued" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ingestion_sources" ENABLE ROW LEVEL SECURITY;