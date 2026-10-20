ALTER TABLE "ingestion_candidates" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "ingestion_candidates" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
ALTER TABLE "ingestion_candidates" ADD COLUMN "opens_at" timestamp;--> statement-breakpoint
ALTER TABLE "ingestion_candidates" ADD COLUMN "amount" text;--> statement-breakpoint
ALTER TABLE "ingestion_candidates" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "kind" text DEFAULT 'perk' NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "opens_at" timestamp;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "amount" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "eligibility" jsonb;