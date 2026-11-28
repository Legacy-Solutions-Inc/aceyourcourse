# 03 — Watching

**What to build:** Members find their Exam's Courses on the Courses screen and watch the Lessons they're allowed to, in a DRM player with their email and Member ID drifting across the video. Locked Courses say exactly how to unlock them.

- **The access decision covers Lessons** (the spec's amended rule):
  - A Free Preview Lesson opens for any signed-in Member.
  - An included Course's Lessons open with an active Access Pass for its Exam: "expired" with "Renew access" when it has ended, "locked" when there's none.
  - A separately sold Course's Lessons open only with **Course Ownership**. An Access Pass never opens them.
  - Active Staff open everything Published.
  - A Hidden Course stays open to the Members who own it, and is unavailable to everyone else. An Unpublished Lesson is unavailable to everyone.
  - The gate and Active Device checks apply as for all content.
- **Course Ownership** records are added here and read by the access decision. Tickets 06 and 07 create them (purchases and gifts); tests use fixtures.
- **The playback pass** is issued only after the access decision allows the Lesson, and only to the Member's Active Device. It carries the Member's email and short Member ID as a watermark drifting across the video. A locked Lesson opened by its address shows the locked screen and gets no pass.
- **The Courses screen** (the existing "Courses" menu item): the selected Target Exam's Visible Courses, plus any Hidden ones the Member owns, grouped by Subject. Each card shows "3 MODULES · 32 LESSONS" and its state:

  | State                                   | Tag          | Button                                        |
  | --------------------------------------- | ------------ | --------------------------------------------- |
  | Owned                                   | OWNED        | Start course                                  |
  | Included, active Access Pass            | IN YOUR PLAN | Start course                                  |
  | Included, no Access Pass                | locked       | See plans                                     |
  | Included, Access Pass ended             | locked       | Renew access (progress kept)                  |
  | Sold separately, not owned, on sale     | locked       | Unlock for ₱1,499 (to that Exam's Plans page) |
  | Sold separately, not owned, not on sale | locked       | Not on sale right now                         |
  - A locked Course with Free Preview Lessons adds "2 FREE LESSONS · Watch free".
  - Empty: "Courses for CE are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now."

- **A Course's page:** its Modules and Lessons with their lengths. A locked Course's Lesson list opens too, and only its Free Preview Lessons play.
- **The Lesson screen:**
  - the player
  - the crumb "PSAD MASTERCLASS · MODULE 2 · LESSON 3", the title and the notes
  - a side panel with the Modules and Lessons
  - "← {previous Lesson}" and "Next lesson →". (Ticket 04 adds Mark complete, resume and the ✓ / ▶ / ○ marks.)
- **The sample player** (the fake): a dark 16:9 frame labelled "SAMPLE VIDEO", with the moving watermark, play and pause, a progress bar and a running clock.
- **No key:** Members see "This video isn't available yet" in place of the player; the rest of the screen works.

**Blocked by:** 02.

**Status:** ready-for-agent

Spec: Phase 3 → "Access decision seam" (amended 2026-11-28); Phase 5 → "Phase 5 planning decisions" (Access and playback, The Courses screen, The VdoCipher key decides); stories 152, 154, 157, 159, 163, 164, 165, 167, 168.

- [ ] Bea (CE All-Access) opens Courses, sees "Surveying & Curves Lectures" IN YOUR PLAN, opens a Lesson and the sample player plays with her email and Member ID moving across it.
- [ ] A Member with no Access Pass sees the included Course locked with "See plans", opens its Lesson list and plays its Free Preview Lesson.
- [ ] A CE All-Access Member sees "PSAD Masterclass" locked with "Unlock for ₱1,499", and "HPGE Crash Course" locked with "Not on sale right now".
- [ ] A Member who owns a Course (fixture) watches it, including after Staff hide it.
- [ ] **Sad paths, each with a test:**
  - an Access Pass never opens a separately sold Course's Lessons ("locked")
  - an ended Access Pass gives "expired" with "Renew access", progress kept
  - an Access Pass for another Exam doesn't open the Course
  - a Hidden Course is unavailable to non-owners, and an Unpublished Lesson to everyone, owners included
  - a playback pass is refused for a locked Lesson, for a replaced device and with no device token
  - the watermark always carries the requesting Member's own email and Member ID
  - an Exam with no Visible Courses shows the empty state
  - with no key, Members see "This video isn't available yet" and no pass is requested
