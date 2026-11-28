# 04 — Resume and progress

**What to build:** a Lesson picks up where the Member stopped, on whichever device they use. Lessons are marked done at 90% or by "Mark complete", and the Member sees their Lessons on Home. Signing in elsewhere stops the video with "Session ended".

- **Lesson progress** per Member and Lesson: the saved position, the furthest point reached, done, and when last watched.
  - Saves happen every 10 seconds while playing, and on pause, at the end and on leaving.
  - Each save runs the device check: on another device the video stops and shows "Session ended".
  - Each save makes the day a Study Day (Manila time), which keeps the streak going.
  - Saves are refused for a Lesson the Member can't open, and positions outside the Lesson's length are refused.
- **Done:**
  - Done once the furthest point reaches 90% of the Lesson's length, skipping ahead included, or by "Mark complete". Done stays done.
  - "Mark complete · next lesson →", and on the last Lesson "Mark complete · finish course", which returns to Courses.
- **Resume:**
  - Reopening picks up at the saved position: "You stopped here 2 days ago. The video picks up at 12:40."
  - A done Lesson starts from the beginning: "You finished this lesson. Watch it again anytime."
- **Where it shows:**
  - the side panel: ▶ now, ✓ done, ○ to do
  - Course cards: "9 / 32" and "Continue: {Lesson} →"
  - Home:
    - "Continue where you left off" includes the last Lesson ("VIDEO LESSON · PSAD · Balanced steel ratio · 12:40 OF 24:10", Resume)
    - each Subject's caption adds "9 lessons"
    - the summary adds "9 / 32 LESSONS", where 32 is the Published Lessons in Courses the Member can open for that Exam
  - the Admin's Member detail: Lesson counts in the progress summary
- **Lessons stay out of the progress %.**
- **Kept and removed:**
  - Lesson progress is kept when access ends and when a Lesson is unpublished.
  - Deleting a Lesson removes its progress. The Lesson delete dialog's "{N} members lose their saved position" now counts real saved positions.
- **Sample data:** Bea Tester has watched some of "Surveying & Curves Lectures", with one Lesson done and a "Continue" spot.

**Blocked by:** 03.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (Watching a Lesson, Progress); Phase 3 → "Progress calculator", "Resume state"; stories 89, 91, 152, 155, 158, 160, 161, 162, 166.

- [ ] Bea plays a Lesson, leaves at 12:40, reloads, and it picks up at 12:40 with "You stopped here…".
- [ ] Reaching 90% marks the Lesson done (✓ in the side panel), and "Mark complete · next lesson →" marks done and opens the next Lesson.
- [ ] Home shows the Lesson in "Continue where you left off", "N lessons" on the Subject, and "N / M LESSONS" in the summary.
- [ ] Watching a Lesson on a day with no other studying makes it a Study Day.
- [ ] **Sad paths, each with a test:**
  - 89.9% isn't done; exactly 90% is; skipping ahead to 95% is
  - done stays done after rewatching from the start
  - a done Lesson resumes from the beginning
  - a save from a replaced device is refused, and the player stops with "Session ended"
  - a save for a locked Lesson, or with a position beyond the Lesson's length, is refused and stores nothing
  - another Member's Lesson progress is never readable
  - the "M" in "N / M LESSONS" counts only Published Lessons in Courses the Member can open (not a locked Course, not an Unpublished Lesson)
  - a save just before and just after Manila midnight lands on the right Study Days
  - progress is kept after the Access Pass ends and shows again on renewal
  - deleting a Lesson removes its progress and the delete dialog counted it
