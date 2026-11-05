import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";
import { databaseArm as seam } from "@/services/admin.db";
import { getWebsiteSettings } from "@/services/catalogue";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { DATABASE_ARM } from "../../test/admin-database";
import { sampleActor, UNUSED_EXAM, withUnusedExam } from "../../test/admin-inputs";

// What only the database arm can get wrong (ticket 15): each write and its
// Staff Activity commit together or not at all, the conflict check holds in
// the database too, deletes cascade as the dialogs count them, and the
// database's own keys never surface as a crash. The Admin suites
// (admin.*.test.ts) check the rest of the behaviour on this arm. Runs in the
// database project, where DATABASE_URL is TEST_DATABASE_URL; skips without it.

const database = await openTestDatabase();

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const db = () => getDb();

const settingsRow = async () => {
  const [row] = await db().select().from(schema.websiteSettings);
  if (!row) throw new Error("no Website settings");
  return row;
};
const stampRows = () => db().select().from(schema.recordStamps);
const activityRows = () => db().select().from(schema.staffActivity);

/**
 * Makes the write fail after its Staff Activity row is in: the row is
 * inserted, then the statement fails. Returns the clean-up.
 */
async function failAfterStaffActivity() {
  await db().execute(sql`
    create function admin_db_test_refuse() returns trigger language plpgsql
    as $$ begin raise exception 'refused by the test'; end $$`);
  await db().execute(sql`
    create trigger admin_db_test_refuse after insert on staff_activity
    for each row execute function admin_db_test_refuse()`);
  return async () => {
    await db().execute(sql`drop trigger admin_db_test_refuse on staff_activity`);
    await db().execute(sql`drop function admin_db_test_refuse()`);
  };
}

describeWithDatabase("Admin seam on the database: transactions", database, () => {
  let opened: { savedAt: string };

  beforeEach(async () => {
    await DATABASE_ARM.reset();
    opened = { savedAt: (await seam.getSettingsForAdmin()).stamp.savedAt };
  });

  afterEach(async () => {
    await DATABASE_ARM.reset();
  });

  it("writes an Owner's Settings save, its stamp and one Staff Activity record together", async () => {
    const result = await seam.updateWebsiteSettings(
      OWNER,
      { contactEmail: "hello@aceyourcourse.ph" },
      opened,
    );
    expect(result).toMatchObject({ ok: true });

    expect((await settingsRow()).contactEmail).toBe("hello@aceyourcourse.ph");
    expect((await getWebsiteSettings()).contactEmail).toBe("hello@aceyourcourse.ph");
    expect(await stampRows()).toContainEqual(
      expect.objectContaining({ record: "settings", updatedBy: OWNER.name }),
    );
    expect(await activityRows()).toEqual([
      expect.objectContaining({
        actorEmail: OWNER.email,
        entity: "settings",
        action: "update",
        before: expect.objectContaining({ contactEmail: CATALOGUE_SEED.settings.contactEmail }),
        after: expect.objectContaining({ contactEmail: "hello@aceyourcourse.ph" }),
      }),
    ]);
  });

  it("leaves no row change, no stamp and no Staff Activity when the write fails at its end", async () => {
    const before = await settingsRow();
    const stampsBefore = await stampRows();
    const restore = await failAfterStaffActivity();
    try {
      await expect(
        seam.updateWebsiteSettings(OWNER, { contactEmail: "hello@aceyourcourse.ph" }, opened),
      ).rejects.toThrow();
    } finally {
      await restore();
    }

    expect(await settingsRow()).toEqual(before);
    expect(await stampRows()).toEqual(stampsBefore);
    expect(await activityRows()).toEqual([]);
  });

  it("leaves the staff list alone when an Invite fails at its end", async () => {
    const before = await db().select().from(schema.staff);
    const restore = await failAfterStaffActivity();
    try {
      await expect(
        seam.inviteStaff(OWNER, { email: "new.editor@example.com", role: "editor" }),
      ).rejects.toThrow();
    } finally {
      await restore();
    }
    expect(await db().select().from(schema.staff)).toEqual(before);
  });

  it("answers conflict when the stamp changed in the database after the write read it", async () => {
    // Another save, made without the write lock while this one runs: a
    // trigger restamps the settings as the Website settings row is written.
    await db().execute(sql`
      create function admin_db_test_restamp() returns trigger language plpgsql
      as $$ begin
        update record_stamps set updated_at = '2030-01-01T00:00:00Z', updated_by = 'Someone Else'
        where record = 'settings';
        insert into record_stamps values ('settings', '2030-01-01T00:00:00Z', 'Someone Else')
        on conflict do nothing;
        return new;
      end $$`);
    await db().execute(sql`
      create trigger admin_db_test_restamp before update on website_settings
      for each row execute function admin_db_test_restamp()`);
    const before = await settingsRow();
    let result;
    try {
      result = await seam.updateWebsiteSettings(
        OWNER,
        { contactEmail: "hello@aceyourcourse.ph" },
        opened,
      );
    } finally {
      await db().execute(sql`drop trigger admin_db_test_restamp on website_settings`);
      await db().execute(sql`drop function admin_db_test_restamp()`);
    }

    expect(result).toEqual({
      ok: false,
      error: { kind: "conflict", savedBy: null, savedAt: opened.savedAt },
    });
    // Rolled back, the other save's stamp with it: nothing was written.
    expect(await settingsRow()).toEqual(before);
    expect(await activityRows()).toEqual([]);
  });

  it("saves one of two writes made at once from the same stamp, and the other conflicts", async () => {
    const [first, second] = await Promise.all([
      seam.updateWebsiteSettings(OWNER, { contactEmail: "first@aceyourcourse.ph" }, opened),
      seam.updateWebsiteSettings(OWNER, { contactEmail: "second@aceyourcourse.ph" }, opened),
    ]);
    const results = [first, second];
    const [saved, ...others] = results.filter((result) => result.ok);
    if (!saved?.ok) throw new Error("neither write saved");
    expect(others).toEqual([]);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: { kind: "conflict", ...saved.value.stamp } },
    ]);
    expect(saved.value.stamp.savedBy).toBe(OWNER.name);
    expect(await activityRows()).toHaveLength(1);
  });

  it("refuses an Editor an Owner-only area, writing nothing", async () => {
    const before = await settingsRow();
    expect(
      await seam.updateWebsiteSettings(EDITOR, { contactEmail: "hello@aceyourcourse.ph" }, opened),
    ).toMatchObject({ ok: false, error: { kind: "forbidden" } });
    expect(
      await seam.inviteStaff(EDITOR, { email: "x@example.com", role: "editor" }),
    ).toMatchObject({ ok: false, error: { kind: "forbidden" } });
    expect(await settingsRow()).toEqual(before);
    expect(await db().select().from(schema.staff)).toHaveLength(4);
    expect(await activityRows()).toEqual([]);
  });

  it("refuses an Invite the staff table's unique key refuses, as the email field's message", async () => {
    // A save that skipped the write lock adds the same email just before.
    await db().execute(sql`
      create function admin_db_test_same_email() returns trigger language plpgsql
      as $$ begin
        if pg_trigger_depth() = 1 then
          insert into staff (email, position, status, role, invited_at, expires_at)
          values (new.email, 99, 'invited', 'editor', now(), now());
        end if;
        return new;
      end $$`);
    await db().execute(sql`
      create trigger admin_db_test_same_email before insert on staff
      for each row execute function admin_db_test_same_email()`);
    let result;
    try {
      result = await seam.inviteStaff(OWNER, { email: "new.editor@example.com", role: "editor" });
    } finally {
      await db().execute(sql`drop trigger admin_db_test_same_email on staff`);
      await db().execute(sql`drop function admin_db_test_same_email()`);
    }

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid",
        fieldErrors: { email: ["This email is already on the staff list."] },
      },
    });
    expect(await db().select().from(schema.staff)).toHaveLength(4);
    expect(await activityRows()).toEqual([]);
  });

  it("refuses an Invite for an email on the list in another case, as the email field's message", async () => {
    expect(
      await seam.inviteStaff(OWNER, { email: "Content@AceYourCourse.PH", role: "editor" }),
    ).toEqual({
      ok: false,
      error: {
        kind: "invalid",
        fieldErrors: { email: ["This email is already on the staff list."] },
      },
    });
    expect(await db().select().from(schema.staff)).toHaveLength(4);
  });
});

describeWithDatabase("Admin seam on the database: deletes", database, () => {
  beforeEach(async () => {
    await DATABASE_ARM.reset();
  });

  afterEach(async () => {
    await DATABASE_ARM.reset();
  });

  it("deletes a Product's Reviews and photos and clears their FAQ quotes, as the preview counts", async () => {
    const preview = await seam.previewProductDelete(EDITOR, "prd-005");
    const reviewIds = (
      await db().select().from(schema.reviews).where(eq(schema.reviews.productId, "prd-005"))
    ).map((review) => review.id);
    const quoting = (await db().select().from(schema.faqs)).filter(
      (faq) => faq.reviewQuoteReviewId && reviewIds.includes(faq.reviewQuoteReviewId),
    );
    const photos = await db()
      .select()
      .from(schema.productPhotos)
      .where(eq(schema.productPhotos.productId, "prd-005"));
    expect(preview).toEqual({
      reviews: reviewIds.length,
      photos: photos.length,
      faqQuotes: quoting.length,
    });

    expect(await seam.deleteProduct(EDITOR, "prd-005")).toMatchObject({ ok: true });

    expect(
      await db().select().from(schema.products).where(eq(schema.products.id, "prd-005")),
    ).toEqual([]);
    expect(
      await db().select().from(schema.reviews).where(eq(schema.reviews.productId, "prd-005")),
    ).toEqual([]);
    expect(
      await db()
        .select()
        .from(schema.productPhotos)
        .where(eq(schema.productPhotos.productId, "prd-005")),
    ).toEqual([]);
    for (const faq of quoting) {
      const [row] = await db().select().from(schema.faqs).where(eq(schema.faqs.id, faq.id));
      expect(row).toMatchObject({ reviewQuoteReviewId: null, reviewQuoteText: null });
    }
    // Staff Activity keeps what was deleted.
    const [record] = await DATABASE_ARM.staffActivity();
    expect(record).toMatchObject({
      entity: "product",
      entityId: "prd-005",
      action: "delete",
      before: expect.objectContaining({ product: expect.objectContaining({ id: "prd-005" }) }),
    });
  });

  it("clears a deleted Review's FAQ quotes", async () => {
    const [quoting] = (await db().select().from(schema.faqs)).filter(
      (faq) => faq.reviewQuoteReviewId !== null,
    );
    if (!quoting?.reviewQuoteReviewId) throw new Error("the seed has no FAQ quoting a Review");

    expect(await seam.deleteReview(EDITOR, quoting.reviewQuoteReviewId)).toMatchObject({
      ok: true,
    });

    const [row] = await db().select().from(schema.faqs).where(eq(schema.faqs.id, quoting.id));
    expect(row).toMatchObject({ reviewQuoteReviewId: null, reviewQuoteText: null });
  });

  it("answers not-found for a Product another session deleted, not conflict", async () => {
    const product = await seam.getProductForAdmin(EDITOR, "prd-005");
    if (!product) throw new Error("no prd-005");
    await DATABASE_ARM.deleteProductElsewhere("prd-005");

    expect(await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false })).toEqual({
      ok: false,
      error: { kind: "not-found" },
    });
    expect(await activityRows()).toEqual([]);
  });
});

// Ticket 23: Exams and Subjects are added and deleted as rows, with no
// migration. The database's keys back up the seam's own checks.
describeWithDatabase("Admin seam on the database: Exams and Subjects", database, () => {
  beforeEach(async () => {
    await DATABASE_ARM.reset();
  });

  afterEach(async () => {
    await DATABASE_ARM.reset();
  });

  const examRow = (code: string) =>
    db().select().from(schema.exams).where(eq(schema.exams.code, code));
  const subjectRows = (code: string) =>
    db().select().from(schema.subjects).where(eq(schema.subjects.examCode, code));

  it("adds an Exam last, with its Subjects, and deletes it with its Subjects and page record", async () => {
    expect(await seam.createExam(OWNER, UNUSED_EXAM)).toMatchObject({ ok: true });
    const [added] = await examRow("CHE");
    expect(added).toMatchObject({
      code: "CHE",
      board: "CHELE",
      position: CATALOGUE_SEED.exams.length,
    });
    expect((await subjectRows("CHE")).map((row) => row.code).sort()).toEqual(["PCHEM", "THERMO"]);
    expect(await seam.setExamSection(EDITOR, "che", "reviews", false)).toMatchObject({ ok: true });

    expect(await seam.deleteExam(OWNER, "che")).toMatchObject({ ok: true });

    expect(await examRow("CHE")).toEqual([]);
    expect(await subjectRows("CHE")).toEqual([]);
    expect(
      await db().select().from(schema.examPages).where(eq(schema.examPages.examCode, "CHE")),
    ).toEqual([]);
  });

  it("refuses an Exam the exams table's key refuses, as the code field's message", async () => {
    // A save that skipped the write lock adds the same code just before.
    await db().execute(sql`
      create function admin_db_test_same_exam() returns trigger language plpgsql
      as $$ begin
        if pg_trigger_depth() = 1 then
          insert into exams (code, position, board, name, long_name, blurb, made_for)
          values (new.code, 99, 'X', 'X', 'X', 'X', 'X');
        end if;
        return new;
      end $$`);
    await db().execute(sql`
      create trigger admin_db_test_same_exam before insert on exams
      for each row execute function admin_db_test_same_exam()`);
    let result;
    try {
      result = await seam.createExam(OWNER, UNUSED_EXAM);
    } finally {
      await db().execute(sql`drop trigger admin_db_test_same_exam on exams`);
      await db().execute(sql`drop function admin_db_test_same_exam()`);
    }

    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid", fieldErrors: { code: ["CHE IS ALREADY AN EXAM"] } },
    });
    expect(await examRow("CHE")).toEqual([]);
    expect(await activityRows()).toEqual([]);
  });

  it("leaves everything as it was when a Product's key refuses the Exam's delete", async () => {
    await DATABASE_ARM.reset(withUnusedExam);
    // A save that skipped the write lock adds a CHE Product just before.
    await db().execute(sql`
      create function admin_db_test_new_product() returns trigger language plpgsql
      as $$ begin
        insert into products (id, position, slug, exam_code, title, short_name, format, size,
          state, deal, available_in_app, show_on_website)
        values ('prd-test', 99, 'che-test', old.code, 'ChE cards', 'ChE cards', 'flash-cards',
          'A6', 'coming-soon', false, false, false);
        return old;
      end $$`);
    await db().execute(sql`
      create trigger admin_db_test_new_product before delete on exams
      for each row execute function admin_db_test_new_product()`);
    let result;
    try {
      result = await seam.deleteExam(OWNER, "che");
    } finally {
      await db().execute(sql`drop trigger admin_db_test_new_product on exams`);
      await db().execute(sql`drop function admin_db_test_new_product()`);
    }

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "A Product now belongs to CHE. Reload the page to see it.",
      },
    });
    expect(await examRow("CHE")).toHaveLength(1);
    expect(await subjectRows("CHE")).toHaveLength(2);
    expect(
      await db().select().from(schema.products).where(eq(schema.products.id, "prd-test")),
    ).toEqual([]);
    expect(await activityRows()).toEqual([]);
  });
});
