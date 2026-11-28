-- The starting Plans (Phase 4, ticket 01; spec, Phase 4 → Plans; story
-- 151q), hand-written: the mockup's prices, for the Exams the database has
-- when it runs. CE gets 30 days for ₱499, 90 days for ₱1,299 (Best value)
-- and 180 days for ₱2,299; every other Exam gets 30 days for ₱449. Every one
-- goes in SWITCHED OFF, so nothing sells at a price the client hasn't
-- confirmed: an Owner switches each on in Plans & prices once they have.
-- Prices are in centavos. Saved by nobody, as the seed's records are.
--
-- Where the exams table is empty when the migrations run (locally, or a new
-- project), this adds nothing: the catalogue load adds the same Plans then,
-- switched off in a production load and on sale in a local one, as the
-- sample data has them (src/lib/catalogue-seed/seed.ts).
-- src/lib/db/starting-plans.db.test.ts checks what this inserts.

insert into public.plans (id, exam_code, name, days, price_centavos, best_value, on_sale, saved_at, saved_by)
select gen_random_uuid(), e.code, e.code || ' All-Access', p.days, p.price_centavos, p.best_value, false, now(), null
from public.exams e
cross join (values (30, 49900, false), (90, 129900, true), (180, 229900, false))
  as p (days, price_centavos, best_value)
where e.code = 'CE'
union all
select gen_random_uuid(), e.code, e.code || ' All-Access', 30, 44900, false, false, now(), null
from public.exams e
where e.code <> 'CE';
