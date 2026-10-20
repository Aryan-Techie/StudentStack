CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"resource_id" integer NOT NULL,
	"status" text DEFAULT 'interested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_resource_id_pk" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "click_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ingestion_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_name" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"tagline" text,
	"description" text NOT NULL,
	"url" text,
	"category_slug" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"region" text,
	"cost_type" text,
	"match_type" text NOT NULL,
	"matched_resource_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"raw_payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text NOT NULL,
	"url" text,
	"has_static_claim_url" boolean DEFAULT true NOT NULL,
	"category_id" integer NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"region" text DEFAULT 'Global' NOT NULL,
	"regions" text[] DEFAULT '{}' NOT NULL,
	"region_locked" boolean DEFAULT false NOT NULL,
	"cost_type" text NOT NULL,
	"verification_needed" text,
	"credit_card_required" boolean,
	"duration" text,
	"deadline" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"last_verified_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"submitted_by" text,
	"approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "ingestion_candidates_matched_resource_id_resources_id_fk" FOREIGN KEY ("matched_resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;