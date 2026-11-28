import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase, rolledBack } from "./test-database";

// The starting Plans on the live database (Phase 4, ticket 01; story 151q;
// supabase/migrations/…_starting_plans.sql): the mockup's prices for the
// Exams the database has, every one switched off, until the client confirms
// the prices and an Owner switches them on. Run again here on the test
// database, in a rolled-back transaction, with CE and one other Exam.

const MIGRATION = join(process.cwd(), "supabase/migrations/20261124013400_starting_plans.sql");

const database = await openTestDatabase();

describeWithDatabase("the starting Plans migration", database, (db) => {
  it("adds CE's three Plans and every other Exam's one, all switched off", async () => {
    const plans = await rolledBack(db(), async (tx) => {
      await tx`delete from plans`;
      for (const [code, position] of [
        ["CE", 1],
        ["ZZT", 99],
      ] as const) {
        await tx`
          insert into exams (code, position, board, name, long_name, blurb, made_for)
          values (${code}, ${position}, 'Board', 'Name', 'Long name', 'Blurb', 'Made for')
          on conflict (code) do nothing`;
      }
      await tx.unsafe(readFileSync(MIGRATION, "utf8"));
      return tx<
        {
          examCode: string;
          name: string;
          days: number;
          priceCentavos: number;
          bestValue: boolean;
          onSale: boolean;
          savedBy: string | null;
        }[]
      >`
        select exam_code as "examCode", name, days, price_centavos as "priceCentavos",
          best_value as "bestValue", on_sale as "onSale", saved_by as "savedBy"
        from plans where exam_code in ('CE', 'ZZT') order by exam_code, days`;
    });

    const plan = (examCode: string, days: number, priceCentavos: number, bestValue = false) => ({
      examCode,
      name: `${examCode} All-Access`,
      days,
      priceCentavos,
      bestValue,
      onSale: false,
      savedBy: null,
    });
    expect(plans).toEqual([
      plan("CE", 30, 49_900),
      plan("CE", 90, 129_900, true),
      plan("CE", 180, 229_900),
      plan("ZZT", 30, 44_900),
    ]);
  });
});
