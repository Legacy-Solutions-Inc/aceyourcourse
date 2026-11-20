# 03 — Onboarding and Target Exams

**What to build:** after consent, a new Member picks their Exam and Exam Date and starts their countdown. Members can add more Target Exams, switch between them, edit each Exam Date and remove one they no longer need. The shell shows the selected Target Exam everywhere the mockup hardcodes CE.

- **Onboarding** (mockup `newUser`):
  - selectable Exam pills for every Exam on the Website. This fixes the mockup bug where the pills couldn't be selected.
  - the Exam Date is prefilled with that Exam's Official Exam Date. If the Exam has none, the Member must pick a date.
  - "Start my countdown" saves the Target Exam and goes to Home.
- **The switcher** (sidebar card and drawer):
  - "STUDYING FOR · SWITCH ▾ / {code} · {board} / {days} days to the exam"
  - the dropdown lists each Target Exam with its Exam Date
  - "+ Add an exam" opens the add form (Plans doesn't exist until Phase 4)
  - the selected Target Exam is remembered per Member
- **Exam Date:**
  - It follows the Official Exam Date until the Member edits it. After that it's theirs.
  - Staff changing the Official Exam Date moves every Member who never edited theirs.
  - Days left count Asia/Manila calendar days.
  - On or after the date, the countdown reads "Exam day" or "Exam passed", as the prompt settles.
- **Removing a Target Exam:** from Account, with a confirmation. It's refused for the Member's last one. Its progress and any Access Pass stay, and adding it back restores them. A simple Account page with a Target Exams section is enough here. Ticket 18 builds the rest of Account.
- **Per Target Exam:** the sidebar badge, the Home header, the countdown label and (later) the Library heading show the selected Exam's code, not "CE".

**Blocked by:** 02.

**Status:** ready-for-agent

Spec: Phase 3 → "Target Exams" and the 2026-11-17 Target Exams decisions; stories 84–88 (countdown only), 133g.

- [ ] A new Member picks an Exam, keeps or changes the date, and sees the countdown on Home.
- [ ] Members add, switch and edit Target Exams. The shell follows the selected one.
- [ ] A Member who never edited the date follows a Staff change to the Official Exam Date. One who edited it doesn't.
- [ ] A Member removes a Target Exam and gets its data back when re-adding it.
- [ ] **Sad paths, each with a test:**
  - Removing the last Target Exam is refused, in the UI and on the server.
  - Adding an Exam that's already a Target Exam is refused, or restores it if it was removed.
  - An Exam with no Official Exam Date needs a date.
  - A date in the past is refused when adding.
  - An Exam that isn't on the Website can't be picked.
  - The countdown is right across Asia/Manila midnight.
  - One Member can never read or change another's Target Exams.
