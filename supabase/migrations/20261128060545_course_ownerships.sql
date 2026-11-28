CREATE TABLE "course_ownerships" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid,
	CONSTRAINT "course_ownerships_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "course_ownerships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_ownerships" ADD CONSTRAINT "course_ownerships_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ownerships" ADD CONSTRAINT "course_ownerships_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ownerships" ADD CONSTRAINT "course_ownerships_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_ownerships_course_id_idx" ON "course_ownerships" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_ownerships_order_id_idx" ON "course_ownerships" USING btree ("order_id");