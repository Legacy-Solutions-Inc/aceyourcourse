# 02 — The Member's Plans page

**What to build:** the Member App's Plans screen (`/app/plans`, today a "Coming in the beta" placeholder) shows what's on sale for each Exam, with the exact date access would end. Buying itself arrives in ticket 03; until then, and wherever no PayMongo key is set, the button reads "Buying opens soon".

- **Who:** the existing Member App guard (signed in, consented, at least one Target Exam). The beta gate still decides who gets in.
- **Exam pills:** one per Exam with at least one Plan on sale, the Member's Target Exams first, opening on their current Exam. `?exam=CE` (an Exam code) picks a pill. Exams with nothing on sale aren't shown.
- **The header:** "PLANS / Choose your access / Pay once for a fixed period. Nothing renews automatically." and "{EXAM} ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS".
- **Plan rows** (radio): duration, price, Best value, and "Until {date}", where the date is max(current Access Pass end, now) + the Plan's days, shown in Manila time. A row whose end reaches the Member's Exam Date adds "covers your exam on {date}".
- **The order summary and Payment Method choice** (QR Ph, GCash, Maya, Card) are laid out as in the mockup, with "You'll finish payment on PayMongo's secure page. We never see or store your card details." and "By paying you agree to the Terms of Use, including Payments and refunds."
- **The button:** "Buying opens soon", disabled, in this ticket (ticket 03 turns it into "Pay {price} with PayMongo" where payments are set up).
- **Staff** see the page with the note "As Staff you already open all content."
- **"See plans" entry points** replace today's beta note:
  - locked content ("Unlock with CE All-Access" → Plans for CE)
  - ended access ("Renew access" → Plans)
  - the dashboard's "Not in your plan · Unlock" tiles
  - the Website Exam page's "See {EXAM} plans" button, which goes through sign-in and returns to Plans for that Exam
  - Exams with nothing on sale keep the "contact us" note

**Blocked by:** 01.

**Status:** ready-for-agent

Spec: Phase 4 → "Phase 4 planning decisions → Who buys, and which Exams", "Renewal reminders" (Plan rows); stories 134, 151c, 151e, 151m.

- [ ] A Member with CE as their Target Exam opens Plans on CE and sees each CE Plan with its "Until" date.
- [ ] A Member with 20 days left on CE sees each "Until" date counting those 20 days.
- [ ] A Member with an Exam Date sees "covers your exam on {date}" on the Plans that reach it, and not on the others.
- [ ] Locked CE content's "See plans" opens Plans on CE.
- [ ] **Sad paths, each with a test:**
  - an Exam with no Plan on sale has no pill, and its locked content keeps the "contact us" note
  - `?exam=` with an unknown or not-on-sale Exam falls back to the Member's current Exam
  - a Plan switched off disappears from the page
  - someone the beta gate doesn't let in never reaches the page
  - an "Until" date near midnight is right in Manila time
  - the button is disabled and reads "Buying opens soon"
  - Staff see the Staff note
