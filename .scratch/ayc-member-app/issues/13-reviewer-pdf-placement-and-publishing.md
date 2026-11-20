# 13 — Reviewer PDF placement, preview and publishing

**What to build:** an Editor places a Draft Reviewer PDF under an Exam, Subject and Topic, creating the Topic there if needed. They preview it as Members will see it, then publish or unpublish it. Publishing is blocked until a Topic is chosen.

- **Placement:**
  - Exam, then Subject, then Topic pickers
  - "+ New topic" creates a Topic in that Subject (ticket 05's rules) without leaving
  - one Reviewer PDF per Topic: placing one on a Topic that already has one is refused, with a link to the existing one
  - "+ Add exam" and "+ Add subject" reuse Phase 2's Owner-only forms
- **Preview:** the Member App reader's view (page by page) for Staff, stamped with the Staff member's own details, reading Draft pages through the Admin.
- **Statuses:**
  - Draft → Published → Unpublished → Published
  - publishing needs a Topic and a successful job
  - only Published Reviewer PDFs show in the Member App
- **Free Preview** switch.
- **Every change** goes in Staff Activity.

**Blocked by:** 12.

**Status:** ready-for-agent

Spec: Phase 3 → "Content model", "Topics editor"; stories 116, 128, 133o.

- [ ] An Editor places a Draft under a new Topic, previews it and publishes it, and it appears in the Library.
- [ ] Unpublishing hides it from Members.
- [ ] **Sad paths, each with a test:**
  - publishing without a Topic is refused, in the UI and on the server
  - publishing a Processing or Failed upload is refused
  - placing on a Topic that already has a Reviewer PDF is refused
  - a duplicate new Topic name is refused
  - an Editor can't use the Owner-only "+ Add exam"
  - Members can't post the actions
