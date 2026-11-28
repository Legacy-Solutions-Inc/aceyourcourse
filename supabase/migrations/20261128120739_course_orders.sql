ALTER TABLE "orders" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_already_owned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_course_id_idx" ON "orders" USING btree ("course_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_one_item" CHECK (("orders"."plan_id" is not null and "orders"."days" is not null and "orders"."course_id" is null) or ("orders"."plan_id" is null and "orders"."days" is null and "orders"."course_id" is not null));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_already_owned_course" CHECK (not "orders"."paid_already_owned" or ("orders"."course_id" is not null and "orders"."paid_at" is not null));