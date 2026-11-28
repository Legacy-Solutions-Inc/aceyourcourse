CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_code" text NOT NULL,
	"name" text NOT NULL,
	"days" integer NOT NULL,
	"price_centavos" integer NOT NULL,
	"best_value" boolean DEFAULT false NOT NULL,
	"on_sale" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"saved_by" text,
	CONSTRAINT "plans_days" CHECK ("plans"."days" in (30, 90, 180, 365)),
	CONSTRAINT "plans_price_whole_pesos" CHECK ("plans"."price_centavos" between 100 and 9999900 and "plans"."price_centavos" % 100 = 0),
	CONSTRAINT "plans_name_present" CHECK (btrim("plans"."name") <> '' and char_length("plans"."name") <= 80)
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "plans_exam_code_idx" ON "plans" USING btree ("exam_code");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_best_value_per_exam_idx" ON "plans" USING btree ("exam_code") WHERE "plans"."best_value";--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_on_sale_per_exam_and_days_idx" ON "plans" USING btree ("exam_code","days") WHERE "plans"."on_sale";