CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"branch" text,
	"year" integer,
	"completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;