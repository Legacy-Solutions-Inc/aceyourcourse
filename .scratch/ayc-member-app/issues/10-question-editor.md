# 10 — Question editor

**What to build:** Editors add, edit, reorder and delete single quiz questions, with a live formula preview and "Save & add next", the same way ticket 07 does cards.

- **The question form:**
  - fields: question, choices A–D, the correct choice, explanation, an optional figure
  - a live preview of the maths
  - "Save" and "Save & add next"
- **Reorder and delete:**
  - deleting a question keeps it for old attempts, which show "This question has since been removed"
  - Best Scores aren't recalculated
- **Every change** goes in Staff Activity, with the conflict check.
- **Reuse:** the card editor's form patterns and preview from ticket 07.

**Blocked by:** 07, 09.

**Status:** ready-for-agent

Spec: Phase 3 → "Corrections never cost progress"; stories 125, 133l.

- [ ] An Editor adds, edits, reorders and deletes questions with the live preview.
- [ ] A deleted question still shows as removed in a Member's old attempt.
- [ ] **Sad paths, each with a test:**
  - no correct choice selected
  - an empty choice
  - a formula error shown and refused
  - a stale edit hits the conflict check
  - deleting the last question of a Visible quiz is handled the same way as ticket 07's last card
  - Members can't post the actions
