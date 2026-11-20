CREATE TABLE "reader_positions" (
	"user_id" uuid NOT NULL,
	"reviewer_pdf_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"zoom" smallint NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reader_positions_user_id_reviewer_pdf_id_pk" PRIMARY KEY("user_id","reviewer_pdf_id"),
	CONSTRAINT "reader_positions_page_positive" CHECK ("reader_positions"."page" > 0),
	CONSTRAINT "reader_positions_zoom_step" CHECK ("reader_positions"."zoom" in (75, 100, 125, 150))
);
--> statement-breakpoint
ALTER TABLE "reader_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviewer_page_views" (
	"user_id" uuid NOT NULL,
	"reviewer_pdf_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"viewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviewer_page_views_user_id_reviewer_pdf_id_page_pk" PRIMARY KEY("user_id","reviewer_pdf_id","page"),
	CONSTRAINT "reviewer_page_views_page_positive" CHECK ("reviewer_page_views"."page" > 0)
);
--> statement-breakpoint
ALTER TABLE "reviewer_page_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reader_positions" ADD CONSTRAINT "reader_positions_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_positions" ADD CONSTRAINT "reader_positions_reviewer_pdf_id_reviewer_pdfs_id_fk" FOREIGN KEY ("reviewer_pdf_id") REFERENCES "public"."reviewer_pdfs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_page_views" ADD CONSTRAINT "reviewer_page_views_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_page_views" ADD CONSTRAINT "reviewer_page_views_reviewer_pdf_id_reviewer_pdfs_id_fk" FOREIGN KEY ("reviewer_pdf_id") REFERENCES "public"."reviewer_pdfs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reader_positions_reviewer_pdf_id_idx" ON "reader_positions" USING btree ("reviewer_pdf_id");--> statement-breakpoint
CREATE INDEX "reviewer_page_views_reviewer_pdf_id_idx" ON "reviewer_page_views" USING btree ("reviewer_pdf_id");