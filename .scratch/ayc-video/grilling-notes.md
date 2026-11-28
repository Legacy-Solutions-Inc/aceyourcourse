# Phase 5 (Video Courses) grilling notes (started 2026-11-26)

These notes feed /to-spec, then /to-tickets. Spec: docs/specs/2026-10-29-ayc-v1.md, Phase 5 (stories 152–156 and "Phase 5: Video Courses (to be planned)").
Contract Milestone 4 (due 4 Dec 2026): video courses with resume, video DRM, copy protection, progress tracking, Email Support page, security review, complete Platform on staging. Contract sections 3.2.2 (one-time products), 3.2.10, 3.3.4 and 3.4 (2–4).

## Decisions

1. **Video service: VdoCipher** (ADR 0013).
   - The client opens the account under the business's email, starts on the 30-day free trial (4 videos, 5 GB of streaming, no card), and buys Starter (USD 149 a year: 1 TB of streaming, 100 GB of storage) before launch.
   - Our server runs the access decision, then asks VdoCipher for a one-time playback pass carrying the Member's watermark. Videos are never served from our storage.
   - Tests, e2e and sample mode use a fake video service. The API secret is server-only; the user sets it, and executers never touch VdoCipher.
2. **Selling a Course separately is in Phase 5, as the last group of tickets** (contract 3.2.2 "one-time products"; the mockup's PSAD Masterclass ₱1,499).
   - First, what Milestone 4 names: the Course builder, uploads, watching with DRM and the watermark, resume and progress. Then Course Orders, Course Ownership, its refund, and Billing, the Payment Acknowledgement and the Admin for Course Orders.
   - If time runs short before 4 Dec, only Course selling slips.
3. **A Course belongs to one Exam and one of that Exam's Subjects**, picked from the list (not typed), never to a Topic.
   - The Exam decides which Access Pass includes it, when it's included in All-Access.
   - The Subject groups it on the Courses screen, and its Lessons can count toward that Subject's progress (decided separately).
   - Moving a Course to another Exam keeps every Course Ownership; who it's included for follows the new Exam (the planner's default, not objected to).
4. **An Access Pass never opens a separately sold Course** (the mockup's HPGE Crash Course: NOT OWNED, locked for a CE All-Access Member).
   - Included in All-Access: opens with an active Access Pass for its Exam; locked with "Renew access" when it ends, progress kept.
   - Sold separately: opens only with Course Ownership, which never expires.
   - Either kind: Free Preview Lessons open for any signed-in Member, and active Staff open everything Published.
   - Fix the spec's access rule: `activeAccessPass(member, content.exam)` applies to all content except a separately sold Course.
5. **Editors build Courses; Owners decide how Members get them and set the price.**
   - A new Course starts as "Included in {Exam} All-Access".
   - Only Owners switch a Course to "Sold separately" or back. Editors see the choice read-only.
   - The price and On sale live in one place: Plans & prices → One-time purchases (Owner-only, logged in Staff Activity like Plans). Switching to Sold separately adds the Course there, not on sale until an Owner sets the price and turns it on. Course settings shows the price read-only with a link to Plans & prices.
   - Switching either way takes effect at once. Included → Sold separately: Members who watched it through their Access Pass lose it, progress kept; the confirmation says how many Members it affects. Sold separately → Included: Course Ownerships stay, and Access Pass holders gain it.
6. **Lessons stay out of the progress %; they show as counts.**
   - Each Subject: "9 lessons" done. The dashboard summary: "9 / 32 LESSONS", where 32 is the Published Lessons in Courses the Member can open for that Exam.
   - Watching a Lesson makes a Study Day (streak), and the last Lesson shows in "Continue where you left off" with its position.
   - Done at 90% of the Lesson's length reached, skipping ahead included (planner's call: "Mark complete" is always one tap away), or by "Mark complete".
7. **Videos are uploaded from the Lesson editor only, straight from the browser to VdoCipher** (our server gets one-time upload permission; the file never passes through our servers).
   - MP4 or MOV, up to 4 GB. Progress: "41% · about 6 min left · keep this page open"; the browser warns before leaving mid-upload.
   - Not resumable (VdoCipher's API is one request): "Upload failed · Try again" starts over. Correct the spec's "resumable uploads".
   - After the upload: "Processing" while VdoCipher prepares it, then ready, with the length filled in from VdoCipher.
   - A Lesson can be published only once its video is ready. "Replace video" uploads a new one and deletes the old one from VdoCipher.
   - No import from a link for now.
8. **Hiding and deleting keep "yours to keep" true.**
   - Hiding a Course: gone from the Courses screen and from sale for everyone except its owners. Members with Course Ownership still see and watch it. Access Pass holders of an included Course see "no longer available", progress kept (as for other content today). The access rule's "available" check must let owners through a Hidden Course.
   - Unpublishing a Lesson hides it from everyone, owners included (to fix and re-upload); progress kept.
   - Deleting a Lesson: typed DELETE, "214 members lose their saved position in this lesson"; it deletes its video from VdoCipher.
   - Deleting a Course: only while no one owns it and no Order names it; otherwise the button explains why and suggests hiding. It removes its Modules, Lessons, their VdoCipher videos and Members' saved positions.
9. **Owners can give and remove a separately sold Course by hand** (same rules as granted access).
   - "Give Course" on the Member's page: Course Ownership, an in-app notice ("You now own the PSAD Masterclass"), logged in Staff Activity.
   - "Remove Course" only for a given Ownership; a paid one goes only by a full refund in PayMongo.
   - Editors can do neither. Billing shows the source: "Given by Ace Your Course" or the Order reference.
   - Part of the last group (Course selling).
10. **Buying a Course reuses the Plans checkout.**
    - The Plans page gets a "One-time purchases" section for the selected Exam: its separately sold Courses on sale. An Exam with only a Course on sale still gets a pill. "Unlock for ₱1,499" on the Courses screen opens that Exam's Plans page at the Course.
    - Same checkout: pick QR Ph, GCash, Maya or Card → PayMongo → the Pending screen. Success: "You own it for good. It never expires." The Order copies the Course's name and price at Pay. Paying adds the Exam to the Member's Target Exams if missing.
    - Already owned: "Owned · Watch", no Pay button.
    - A second Order for the same Course that gets paid anyway (two tabs, a late payment) is recorded Paid and grants nothing; Needs attention shows "Course already owned · refund in PayMongo" (like Phase 4's deleted-account case).
    - Not on sale: not listed; its locked card says "Not on sale right now".
11. **Course Orders follow the Phase 4 rules everywhere else.**
    - Full refund removes Course Ownership unless another Paid Order or a gift still holds it. Notice: "Your refund for AYC-10483 was processed. You no longer own the PSAD Masterclass." Logged as "PayMongo (system)". Partial refund: ownership unchanged, "PARTIALLY REFUNDED".
    - Billing: "Your Courses" beside Access Passes; Course Orders in the history. Payment Acknowledgement: "PSAD Masterclass · Video course · yours to keep", no access period.
    - Orders admin and CSV: Course Orders with the Course's name, and a Plans vs Courses filter. Invoice Requests work the same.
    - Sales figures count paid Course Orders (Test Orders excluded).
    - Deleting an account removes its Course Ownerships (like Access Passes); its Course Orders stay, detached.
    - "Download this Member's data" adds Course Ownerships and Lesson progress.
    - Legal v2.2: the Terms' "Payments and refunds" adds that a Course is a one-time purchase with no expiry and a refund removes it; Members agree once more (still pending legal review).
12. **Watching a Lesson.**
    - Watermark: the Member's email and short Member ID drifting across the video (VdoCipher draws it from the playback pass).
    - Screen recording: blocked by VdoCipher on devices with hardware DRM (recording shows black); elsewhere the watermark deters.
    - One device: a playback pass only for the Active Device. Position saves every 10 seconds while playing also check the device; signed in elsewhere → the video stops, "Session ended".
    - Resume at the saved spot ("You stopped here 2 days ago. The video picks up at 12:40."); a done Lesson starts from the beginning ("You finished this lesson. Watch it again anytime.").
    - Any Lesson can be opened (no forced order). "Mark complete · next lesson →"; on the last Lesson "Mark complete · finish course" (back to Courses). Side panel: Modules and Lessons, ▶ now, ✓ done, ○ to do.
    - Staff: the Lesson editor's preview plays the real video, watermarked with their email, no device check (the Admin is exempt).
13. **The Courses screen** shows the selected Target Exam's Visible Courses, grouped by Subject.
    - Card states: Owned → OWNED, Continue / Start course. Included + active Access Pass → IN YOUR PLAN, Continue / Start course. Included, no pass → locked, See plans. Included, pass ended → locked, Renew access (progress kept). Sold separately, not owned, on sale → locked, Unlock for ₱X. Not on sale → locked, "Not on sale right now".
    - A locked Course with Free Preview Lessons adds "2 FREE LESSONS · Watch free"; its Lesson list opens, and only Free Preview Lessons play.
    - Card meta: "3 MODULES · 32 LESSONS", progress "9 / 32", "Continue: {Lesson} →".
    - Empty: "Courses for CE are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now."
    - Owned Courses always show, even when Hidden (decision 8).
14. **The VdoCipher key decides** (like the PayMongo key).
    - Sample mode and e2e: a fake video service. The player is a dark 16:9 frame labelled "SAMPLE VIDEO" with the moving watermark, play/pause, a progress bar and a running clock (resume, the 90% rule and "Session ended" all work, no video file). Uploads: a quick progress bar, "Processing" for a few seconds, then ready with a made-up length.
    - A deploy without the key: the Lesson editor says "Connect the video service to upload" (upload off); Members see "This video isn't available yet"; everything else works.
    - With the key: real uploads and DRM playback.
    - Sample data: "Surveying & Curves Lectures" (CE · MSTC, Included in CE All-Access, 2 Modules, 5 Lessons, 1 Free Preview; Bea has watched some, so she has a "Continue" spot); "PSAD Masterclass" (CE · PSAD, Sold separately, ₱1,499, on sale, owned by nobody, so Bea can buy it in the demo); "HPGE Crash Course" (CE · HPGE, Sold separately, not on sale).
15. **The Course builder** (the mockup's "Courses & videos", Editors and Owners).
    - List: "COURSES · 3" (Exam, Lesson count, HIDDEN/VISIBLE), "+ New course".
    - Course settings: title, description, optional 16:9 cover (cards without one show the Subject block), Exam, Subject, "How members get it" (Owner-only, decision 5).
    - Modules: "+ Module", title edited in place, ▲▼ to reorder. A Module with Lessons can't be deleted until they're moved or deleted.
    - Lessons: "+ Lesson", ▲▼ within a Module plus "Move to Module…"; FREE PREVIEW tag; state: no video, uploading, processing, draft, published, upload failed.
    - Lesson editor: title, video, notes shown under the video (plain text with line breaks), Free Preview, Publish / Unpublish, Save, Delete. Publishing needs a title and a ready video ("ADD A TITLE BEFORE PUBLISHING", "ADD A VIDEO BEFORE PUBLISHING", "WAIT FOR THE VIDEO TO FINISH UPLOADING").
    - A Course becomes Visible only with at least one Published Lesson; then "214 members have access".
    - Every change logged in Staff Activity; edit conflicts guarded as for decks and quizzes today.
16. **A security review ticket** (Milestone 4 item), after the video tickets and before Course selling.
    - An executer checks the whole Platform and writes `docs/security-review.md`, a plain report for the client; small issues fixed in place, bigger ones listed as follow-ups.
    - Checks: Google-only sign-in (the temporary `ADMIN_PASSWORD_SIGN_IN` password sign-in is flagged only, not removed, unless the user says so); every table denies direct browser access and Members read only their own data; every protected read (decks, quizzes, Reviewer PDF pages, video playback passes) goes through the access decision on the server; Owner-only actions refused to Editors on the server; secrets server-only, PayMongo webhook signature and cron secret checked; security headers, with only VdoCipher's player allowed to be embedded; uploads and inputs checked on the server; `pnpm audit`.
17. **Branch: `feat/phase5-video`**, started from the tip of `feat/phase4-payments` (15 commits ahead of main, not merged, on 2026-11-26). The first executer creates it; every Phase 5 ticket shares it.
    - Phase 4 merges to main on its own track (the Milestone 3 handover). Phase 5's later pull request then shows only Phase 5's work.
    - Executers: if main is ahead, fast-forward only, never rebase; stop and ask if that fails.

## Out of scope (planner's defaults)

- Courses on the public Website.
- Import from a link (Google Drive, Dropbox) and resumable uploads.
- Captions, downloads or offline viewing, and forced Lesson order.
- Email about Courses (no sending domain yet).
- Proportional ownership changes for partial refunds.
