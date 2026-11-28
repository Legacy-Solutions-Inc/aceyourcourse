CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('qrph', 'gcash', 'maya', 'card');--> statement-breakpoint
CREATE SEQUENCE "public"."order_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text DEFAULT ('AYC-' || nextval('order_reference_seq')) NOT NULL,
	"user_id" uuid,
	"exam_code" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_name" text NOT NULL,
	"days" integer NOT NULL,
	"price_centavos" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "order_status" NOT NULL,
	"livemode" boolean NOT NULL,
	"checkout_id" text,
	"payment_id" text,
	"buyer_name" text,
	"buyer_email" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_reference_unique" UNIQUE("reference"),
	CONSTRAINT "orders_reference_format" CHECK ("orders"."reference" ~ '^AYC-[0-9]{5,}$'),
	CONSTRAINT "orders_days" CHECK ("orders"."days" in (30, 90, 180, 365)),
	CONSTRAINT "orders_price_whole_pesos" CHECK ("orders"."price_centavos" between 100 and 9999900 and "orders"."price_centavos" % 100 = 0),
	CONSTRAINT "orders_paid_at_once_paid" CHECK (("orders"."status" in ('paid', 'refunded')) = ("orders"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_pass_grants" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_plan_id_idx" ON "orders" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_checkout_id_idx" ON "orders" USING btree ("checkout_id") WHERE "orders"."checkout_id" is not null;--> statement-breakpoint
ALTER TABLE "access_pass_grants" ADD CONSTRAINT "access_pass_grants_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_pass_grants_order_id_idx" ON "access_pass_grants" USING btree ("order_id");