ALTER TABLE "reviews" ADD COLUMN "verified_student" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_resource_user_unique" ON "reviews" USING btree ("resource_id","user_id");