# 15 — Dashboard and progress

**What to build:** Home becomes the dashboard for the selected Target Exam. It shows:

- days left
- "Continue where you left off"
- the Study Streak (current, best, last 7 days)
- progress per Subject
- the 3 weakest Topics, with "Review cards" and "Retake quiz"

The Library shows the Member's % per Topic.

- **The progress calculator:** pure functions over the current-state records (Card Marks, Quiz Attempts, pages viewed, Study Days).
  - **Topic %:** the mean of the components present (share of cards marked got, Best Score %, share of pages viewed).
  - **Subject %:** the mean of its Topic %.
  - **Quiz average:** the mean of Best Scores across the quizzes taken.
  - **Weak Topic:** Best Score below passing, or 5 or more cards marked again. The 3 lowest show, lowest first.
  - **Study Streak:** consecutive Asia/Manila Study Days, current and best.
  - Hidden or Draft content is left out.
- **The dashboard** (mockup `dashboard`):
  - **countdown**
  - **"Continue where you left off":** the last deck and the last Reviewer PDF page, from resume state
  - **the streak card and the sidebar streak button**
  - **per-Subject progress:** %, cards marked, quiz average, and lessons done (hidden until Phase 5)
  - **weak Topics:** linking to the deck or quiz
- **Empty states:** a new Member with no study yet sees a starter state, not zeros everywhere.
- **The mockup's `loading` state** shows while the data loads.

**Blocked by:** 08, 11, 14.

**Status:** ready-for-agent

Spec: Phase 3 → "Progress calculator", "Progress storage", "Resume"; stories 88–92, 93 (%).

- [ ] The dashboard shows the right numbers for a Member with cards, quizzes and pages in progress.
- [ ] "Continue" opens the last deck and the last page.
- [ ] The Library shows each Topic's %.
- [ ] **Sad paths, each with a test** (pure, over fixtures):
  - re-marking a card counts only the latest mark
  - Best Score is used, not the latest attempt
  - a Topic missing a deck, quiz or PDF
  - exactly the passing score is not weak
  - exactly 5 "again" marks is weak
  - streaks across Manila midnight
  - a gap day breaks the streak
  - the best streak is kept
  - an empty history
  - Hidden content is left out
  - fewer than 3 weak Topics shows only those
  - expired access keeps progress visible
