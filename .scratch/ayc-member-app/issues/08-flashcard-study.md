# 08 — Flashcard study

**What to build:** a Member studies a Topic's deck one card at a time. They flip with a tap or space, and mark with a swipe or the arrow keys (Got it / Review again). They finish on a summary with "Review the N", and come back to where they left off.

- **The deck player** (mockup `flashcards`, `deckDone`):
  - the front, then the back with rendered maths and an optional image
  - the note
  - "Got it" and "Review again"
  - a progress count
  - keyboard: space flips, → is Got it, ← is Review again
  - touch: tap flips, swipe marks
- **Card Marks:** the latest verdict per card is saved on the server.
- **Study Day:** marking a card counts as a Study Day (Asia/Manila date).
- **The summary:** "41 of 48 got it · 7 to review again", with "Review the 7" (a session over just those cards) and back to the Library.
- **Resume:** the last position in each deck is stored, and opening the deck offers to continue there.
- **Protection:**
  - every deck read goes through the access decision
  - card images are signed URLs (about 10 minutes) handed out only with an allowed read
  - an overlay watermark with the Member's email and short Member ID
  - no text selection
- **States:**
  - locked: the unlock prompt
  - expired: renew, progress kept (mockup `expired`)
  - replaced: Session ended
  - unavailable: "no longer available"
  - empty or Hidden: a Topic still being prepared

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Burned-in watermark" (overlay part), "Progress storage", "Resume"; stories 95–97, 104, 106.

- [ ] A Member studies a deck with keyboard and touch, and their marks are saved.
- [ ] The summary counts are right, and "Review the N" drills only those.
- [ ] Reopening resumes at the last card.
- [ ] Free Preview progress carries over when a pass starts.
- [ ] **Sad paths, each with a test:**
  - a locked deck's cards are never sent to the browser
  - an expired pass shows renew and keeps marks
  - a deck hidden mid-session shows "no longer available"
  - a replaced device's mark is refused with no change
  - re-marking a card keeps only the latest mark
  - an image URL stops working after it expires
  - one Member's marks never reach another
  - Hidden decks never appear
