# 12 — Catalogue spreadsheet template and seed converter

**What to build:** The client can fill in a spreadsheet of their full catalogue (about 29 Products across about 11 Exams). A developer then turns it into the Website's seed in one run. The run:

- validates every row and reports row-level errors before anything changes
- converts prices to centavos
- optimises the photos into self-hosted images
- writes the typed seed the Catalogue seam reads

The mockup data ships as a sample spreadsheet, and converting it reproduces today's seed.

**Blocked by:** 02 — Product page (it needs the Product and Review model and the seed validation).

**Status:** ready-for-agent

Spec: Implementation Decisions → Phase 1 (Seed data: replaced by the client's spreadsheet), Media; Further Notes → Phase 1 launch blocker (the client's catalogue spreadsheet).

- [ ] A template is supplied: one CSV per sheet (Exams, Subjects, Products, Variations, Reviews), headers plus one example row, and a README explaining every column for a non-technical client. It says sample formula cards are sent separately.
- [ ] A check mode validates without writing anything. Each error gives the sheet, row number, column and reason, for example an unknown Exam code, a duplicate slug, a bad price, a Listing on the wrong host, a missing photo file, or a Coming Soon Product with a price.
- [ ] With any error, the command exits non-zero and changes no files.
- [ ] A successful run:
  - writes the generated seed
  - optimises each Product's photos (in order, the first being the cover) into self-hosted images within the size budget
  - prints a summary (Exams, Products Live and Coming Soon, Reviews, photos written)
- [ ] The generated seed passes the same seed validation the seam uses. The Catalogue seam behaviour tests still pass against it.
- [ ] The mockup data is supplied as the sample spreadsheet. Converting the sample produces a seed equivalent to the current one.
- [ ] Tests cover:
  - a valid sample converts
  - each row-error type is reported with its row number
  - nothing is written on error
  - the peso-to-centavo conversion (including ₱1,249.50)
  - a Coming Soon row with no price is accepted
