ALTER TABLE "profiles" ADD COLUMN "eligibility" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_calendar_token_unique" UNIQUE("calendar_token");