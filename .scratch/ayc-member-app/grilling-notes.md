# Phase 3 grilling notes (started 2026-11-17)

Branch: `feat/phase3-member-app` (from main at 932c8fc). Every Phase 3 ticket shares it.
These notes feed /to-spec, then /to-tickets. Spec: docs/specs/2026-10-29-ayc-v1.md, Phase 3.

## Decisions

1. **Beta gate.** While MEMBER_APP_LIVE is off, /app admits only Staff and Beta Testers.
   - Owners add Beta Testers by Google email, before the account exists.
   - Anyone else who signs in sees "Not open yet".
   - Once the switch is on, anyone can join.
   - "Beta Tester" was added to CONTEXT.md.
2. **A tester's pass is separate.** Adding a Beta Tester only opens the gate.
   - The Owner grants an Access Pass from Users after the tester's first sign-in.
   - Until then the tester has Free Preview only.
3. **Staging: vertical slices.** Each ticket covers tables, migration, database plus sample implementation, UI and tests.
   - e2e stays on in-memory sample data.
   - Database suites run in CI only.
   - The user applies migrations to hosted after merging.
4. **A session with no device token** (for example, signed in through /admin first) shows a one-tap "Use the Member App on this device" screen.
   - Confirming makes this device the Active Device and logs the switch.
   - The old device gets "Session ended".
   - There's no silent claim and no second Google prompt.
5. **Beta legal.** Phase 3 drafts Legal v2.0 (the Member App sections), marked "pending legal review".
   - Beta Testers agree to the draft on the consent screen.
   - The lawyer-approved text bumps the version, and everyone is asked to agree again.
6. **The PDF job.** The Editor uploads straight to private Supabase Storage with a resumable upload (Vercel's body limit is about 4.5 MB).
   - A job row in Postgres tracks progress.
   - A Vercel function renders batches of about 25 pages with pdf.js on a server canvas (permissive licences, no AGPL MuPDF), saves each batch and chains the next.
   - A Vercel Cron every minute restarts stalled jobs.
   - The Editor can leave the page.
7. **The watermark.** Pages are stamped on every request with sharp, and the access decision runs every time.
   - Only the Member's browser caches a page (Cache-Control: private, a short max-age). There's no CDN or Storage copy.
   - This revises the spec's "caches the stamped image per Member and page".
8. **A small Topics editor per Subject in the Admin.** Editors can rename a Topic, move it up or down, and delete it only when it's empty.
   - A Topic is made by an import (in order of first appearance in the CSV, added after the existing ones), by "+ New topic" when placing a Reviewer PDF, or by hand.
   - Progress is tied to the Topic, never to its name.
   - Imports match Topics by name, so re-importing under an old name creates a new Topic.
9. **Quiz Replace keeps every Member's Best Score and attempt history.**
   - In an old attempt, removed questions show "This question has since been removed".
   - Retakes use the new questions.
10. **Formula notation.** Every text field is plain text with maths in $...$ (inline) or $$...$$ (its own line).
    - That covers the card front, back and note, and the quiz question, choices and explanation.
    - A literal dollar sign is written \$.
    - A formula KaTeX can't render is a row-level import error naming the cell.
    - The Admin's live preview uses the same renderer.
11. **Card back images and quiz figures** are kept in a private bucket.
    - The server hands out signed URLs (about 10 minutes) only after the access decision allows the deck or quiz read.
    - They aren't stamped. The overlay watermark covers them on screen.
12. **Privacy Requests in the Admin.**
    - **Data copy:** a "Download this Member's data" JSON file (profile, Target Exams, consents, Access Passes, progress, device log). The Owner emails it from the support inbox.
    - **Deletion:** "Delete this account" with a typed confirmation. It removes the Supabase user and all their Member data, and Staff Activity logs it without the personal data.
    - Both then mark the request done. Nothing is emailed automatically.
13. **Removing a Target Exam.** Members can remove one from the Account page with a confirmation, but never their last one.
    - Its progress and Access Pass stay, and adding it back restores them.
14. **A grant for an Exam the Member doesn't have** adds it to their Target Exams (with the Official Exam Date), including one they removed earlier.
    - The in-app notice reads "You now have {Exam} All-Access until {date}".
15. **Progress is stored as current-state records**, not an event log.
    - The records are the latest Card Mark per card, every Quiz Attempt, the Reviewer pages viewed, and Study Days (Member + Manila date).
    - The pure progress calculator reads them.
16. **Member App analytics** is the same anonymous, cookieless, PageView-only PostHog as the Website (ADR 0009).
    - No person profiles, and no Member ID.
    - Phase 3 adds no new content-usage report. The Member detail page has the progress summary.
17. **"End access now"** is Owner only, on the Member detail page.
    - It needs a reason, sets the pass to end now, keeps progress, and is logged in Staff Activity.
    - The Member sees "expired, progress kept".
    - From Phase 4 it can end only grant days, never paid ones (refunds handle those).
18. **Active Staff can open all Visible or Published content for every Exam in /app without an Access Pass.**
    - They're still subject to the Active Device, and Hidden or Draft content never shows in /app.
    - ADR 0010 has an amendment saying so.

## Defaults assumed (not asked; confirm or change)

- **Quizzes are graded on the server.**
  - Correct answers and explanations never reach the browser before submit.
  - With "show answers after" off, the result shows only the score and which questions were missed.
- **Beta Testers live in the Owner-only Users screen**, in a "Beta Testers" tab (add an email, remove).
  - Removing a tester blocks them at their next request while the switch is off. Their data is kept.
- **"Delete this account" is refused** for anyone on the staff list until they're removed from it. The last Owner can never be deleted.
- **In-app notices** (grants, extensions, end of access) are a dismissible banner. There's no notification centre.
- **"Continue where you left off"** covers the deck and the Reviewer PDF in Phase 3. Lessons come in Phase 5.
- **Content hidden or unpublished mid-study** shows "no longer available" on the next request. Progress is kept.
  - Hidden or Draft content never counts in progress denominators.
- **Grant lengths:** 30, 90, 180 or 365 days, or a custom 1–365. Extensions are 3, 7, 14 or 30 days.
- **The device token** is a random httpOnly, Secure, SameSite=Lax cookie, stored hashed.
- **Reviewer PDF page images** are rendered once at about 1600 px wide (WebP). The 75–150% zoom happens in the browser.
