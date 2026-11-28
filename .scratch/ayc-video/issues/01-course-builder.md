# 01 — Course builder

**What to build:** Editors and Owners build video Courses in the Admin (Content → "Courses & videos"): Courses, their Modules and their Lessons, in the right order, before any video exists. This ticket starts Phase 5's branch, `feat/phase5-video`, from the tip of `feat/phase4-payments`.

- **The list:** "COURSES · N", each with its Exam, Lesson count and HIDDEN or VISIBLE, and "+ New course".
- **Course settings:**
  - title, description, and an optional 16:9 cover, uploaded the same way as Product photos. Cards without a cover show the Subject block.
  - the Exam, and one of that Exam's Subjects picked from the list (never typed, never a Topic)
  - "How members get it", shown read-only for now: "Included in {Exam} All-Access" (the default for a new Course) or "Sold separately · ₱1,499". The Course carries that choice, its price and On sale; the Owner's switch and price editing come in ticket 06.
  - Hidden by default.
- **Modules:** "+ Module", the title edited in place, ▲▼ to reorder. A Module with Lessons can't be deleted until they're moved or deleted.
- **Lessons:** "+ Lesson", a title, notes shown under the video (plain text with line breaks), a Free Preview flag, ▲▼ within a Module, and "Move to Module…".
  - Every Lesson shows NO VIDEO for now. Publish stays refused with "ADD A VIDEO BEFORE PUBLISHING" until ticket 02 adds videos.
  - Deleting a Lesson needs typing DELETE: "{N} members lose their saved position in this lesson". N comes from saved positions, which are zero until ticket 04 stores them.
- **Visibility:** a Course can be made Visible only with at least one Published Lesson ("Needs at least one published lesson"), so every Course stays Hidden in this ticket.
- **Deleting a Course** removes its Modules and Lessons. (Ticket 06 adds the guard for Courses someone owns or an Order names.)
- **Moving a Course to another Exam** needs a Subject from the new Exam.
- **An Exam or Subject with a Course** isn't "unused", so it can't be deleted.
- **Records:** every change is logged in Staff Activity, under a readable "Courses" area. Two Staff editing the same Course can't overwrite each other: the conflict check used for decks and quizzes.
- **Sample data:** the three sample Courses, with Modules and Lessons and no videos yet:
  - "Surveying & Curves Lectures" (CE · MSTC): included, 2 Modules, 5 Lessons, 1 of them Free Preview
  - "PSAD Masterclass" (CE · PSAD): sold separately at ₱1,499, on sale
  - "HPGE Crash Course" (CE · HPGE): sold separately, not on sale
- Nothing shows in the Member App yet.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (A Course, Who does what, The Course builder, Hiding, unpublishing and deleting, Sample data); stories 156, 174, 175, 177, 179.

- [ ] An Editor creates "PSAD Masterclass" for CE · PSAD, adds 2 Modules and 3 Lessons, reorders them, moves a Lesson to the other Module and renames a Module; the order holds after a reload.
- [ ] An Owner can do the same; every change appears in Staff Activity under "Courses".
- [ ] The sample Courses appear in sample mode, with their Modules, Lessons and how Members get them.
- [ ] **Sad paths, each with a test:**
  - a Subject that isn't one of the Course's Exam's Subjects is refused, on create and on moving the Course to another Exam
  - an empty or over-long title is refused (Course, Module and Lesson)
  - deleting a Module that still has Lessons is refused
  - making a Course Visible without a Published Lesson is refused with "Needs at least one published lesson"
  - publishing a Lesson without a video is refused with "ADD A VIDEO BEFORE PUBLISHING"
  - deleting a Lesson without typing DELETE does nothing
  - a stale edit (another Staff member saved first) shows the conflict message and changes nothing
  - an Exam or Subject with a Course can't be deleted
  - a cover of the wrong type or size is refused
  - Editors see "How members get it" read-only, with no way to change it
  - non-Staff are refused every builder action on the server
