# 05 — Content model, Topics editor, Library and the access decision

**What to build:** the Library lists every Subject and Topic of the selected Target Exam. Each Topic's deck, quiz and Reviewer PDF shows as open, Free Preview or locked "🔒 Unlock with {Exam} All-Access". Editors manage each Subject's Topics in the Admin. One server-side access decision decides every protected read from here on.

- **The content model:**
  - Exam → Subject → Topic.
  - A Topic has an optional deck, quiz and Reviewer PDF.
  - Decks and quizzes are Hidden or Visible. Reviewer PDFs have the statuses in the spec, with only the record and status needed here.
  - Each can be flagged Free Preview.
  - This ticket adds the tables and the sample data that the rest of Phase 3 fills. Cards, questions and page images are added by later tickets, though the sample data may include a few for the Library to show.
- **The Access Pass record:** one per Member per Exam, with an end date and its history of contributing grants. Granting comes in ticket 17. Here the sample data and test fixtures create passes.
- **The access decision:** a pure function, plus the server function that gathers its inputs. Every protected read from now on goes through it. It returns:
  - allowed
  - locked (the unlock prompt)
  - expired (renew, progress kept)
  - device-replaced or no-token (from ticket 04)
  - unavailable (Hidden or Unpublished: "no longer available")
  - not open yet (the gate)

  These cases allow access:
  - Free Preview
  - an active Pass for the content's Exam (end later than now, Asia/Manila)
  - active Staff, who open Visible or Published content only (ADR 0010 amendment)

- **The Library** (mockup `library`):
  - Subjects, then their Topics in Topic order
  - each Topic's available content types with their state
  - empty Topics say their content is still being prepared (mockup `emptyTopic`)
  - "Unlock with {Exam} All-Access" shows the locked state. With no Plans before Phase 4, it explains access comes from AYC during the beta.
  - per-Topic % is a placeholder until ticket 15
- **The Topics editor in the Admin** (Editors and Owners):
  - in Member App content, a Subject's Topics list: add, rename, move up or down, delete only when it has no deck, quiz or Reviewer PDF
  - every change in Staff Activity
  - names are unique within the Subject
  - reviewers, decks and quizzes now block deleting their Exam or Subject, completing ticket 23's note

**Blocked by:** 03, 04.

**Status:** ready-for-agent

Spec: Phase 3 → "Content model", "Access decision seam", "Topics editor"; stories 93, 94, 103, 133i, 133m, 133n; ADRs 0010 (with its amendment) and 0011.

- [ ] A Member with no pass sees Free Preview open and the rest locked. One with an active pass sees their Exam open.
- [ ] Staff with no pass see all Visible content open.
- [ ] Editors add, rename, reorder and delete empty Topics, and the Library follows.
- [ ] The access decision is used by the Library's states and is ready for the protected reads.
- [ ] **Sad paths, each with a test** (the access decision as a table):
  - a pass for another Exam
  - a pass ending today, before and after Manila midnight
  - an expired pass
  - Hidden content for a Member and for Staff
  - a replaced device
  - no token
  - the gate closed for a non-tester
  - removed Staff treated as a Member
  - deleting a non-empty Topic is refused
  - a duplicate Topic name is refused
  - an Exam or Subject with content can't be deleted
  - an Editor can manage Topics, but Members can't post Admin actions
