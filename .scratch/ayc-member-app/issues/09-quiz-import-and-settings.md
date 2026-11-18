# 09 — Quiz import and quiz settings

**What to build:** an Editor imports a Subject's quizzes from a spreadsheet plus a zip of figures. They preview the row errors, then confirm. The quizzes arrive Hidden. Each quiz has its passing score, shuffling and "show answers after" settings.

- **The template:** columns topic, question, choice A, choice B, choice C, choice D, correct answer (A–D), explanation, figure filename. All text fields use the formula notation from ticket 06.
- **The planner:** extends ticket 06's pure planner. Its row errors also cover a correct answer that isn't A–D, a missing choice, and a figure not in the zip.
- **Re-importing a Topic that has questions:** Replace or Add.
  - Replace keeps every Member's Best Score and attempt history.
  - Removed questions are kept for old attempts to show as removed.
- **Settings per quiz** (in the Admin):
  - passing score: 1–100%, default 70%
  - shuffle questions: on or off
  - show answers after: on or off
  - Free Preview: on or off
  - Visible or Hidden: Visible is refused while the quiz is empty
- **Confirming:** saves everything or nothing, figures go to the private bucket, quizzes arrive Hidden, and the import is recorded in Staff Activity.

**Blocked by:** 06.

**Status:** ready-for-agent

Spec: Phase 3 → "Spreadsheet import", "Corrections never cost progress"; stories 119–124, 126–128, 133l.

- [ ] A valid quiz CSV plus zip previews correctly and confirms into Hidden quizzes with figures.
- [ ] Settings save and show in the quiz's Admin screen.
- [ ] Replace keeps Members' Best Scores and attempts.
- [ ] **Sad paths, each with a test:**
  - a correct answer of "E" or empty
  - a missing choice
  - a missing figure
  - a formula error with the row and column named
  - a passing score of 0 or 101
  - making an empty quiz Visible is refused
  - confirming with errors is refused on the server
  - a failure halfway saves nothing
  - Members can't post the actions
