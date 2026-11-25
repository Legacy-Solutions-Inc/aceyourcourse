CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "order_refunds" (
	"refund_id" text PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_centavos" integer NOT NULL,
	"status" "refund_status" NOT NULL,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "order_refunds_amount_positive" CHECK ("order_refunds"."amount_centavos" > 0),
	CONSTRAINT "order_refunds_refunded_at_once_succeeded" CHECK (("order_refunds"."status" = 'succeeded') = ("order_refunds"."refunded_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "order_refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_pass_grants" DROP CONSTRAINT "access_pass_grants_ends_after_start";--> statement-breakpoint
ALTER TABLE "member_notices" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_refunds_order_id_idx" ON "order_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_payment_id_idx" ON "orders" USING btree ("payment_id") WHERE "orders"."payment_id" is not null;--> statement-breakpoint
ALTER TABLE "access_pass_grants" ADD CONSTRAINT "access_pass_grants_ends_not_before_start" CHECK ("access_pass_grants"."ends_at" >= "access_pass_grants"."starts_at");--> statement-breakpoint
ALTER TABLE "member_notices" ADD CONSTRAINT "member_notices_reference_format" CHECK ("member_notices"."reference" ~ '^AYC-[0-9]{5,}$');