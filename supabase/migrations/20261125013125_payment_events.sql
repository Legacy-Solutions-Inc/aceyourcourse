CREATE TABLE "payment_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"order_id" uuid,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_order_id_idx" ON "payment_events" USING btree ("order_id");