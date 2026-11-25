CREATE TABLE "invoice_requests" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"tin" text,
	"requested_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_email" text,
	"sent_by_name" text,
	CONSTRAINT "invoice_requests_name_present" CHECK (btrim("invoice_requests"."name") <> ''),
	CONSTRAINT "invoice_requests_address_present" CHECK (btrim("invoice_requests"."address") <> ''),
	CONSTRAINT "invoice_requests_tin_format" CHECK ("invoice_requests"."tin" ~ '^[0-9]{3}-[0-9]{3}-[0-9]{3}(-[0-9]{3}|-[0-9]{5})?$'),
	CONSTRAINT "invoice_requests_sent_when_and_by_whom" CHECK (("invoice_requests"."sent_at" is null and "invoice_requests"."sent_by_email" is null and "invoice_requests"."sent_by_name" is null)
        or ("invoice_requests"."sent_at" is not null and "invoice_requests"."sent_by_email" is not null and "invoice_requests"."sent_by_name" is not null))
);
--> statement-breakpoint
ALTER TABLE "invoice_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;