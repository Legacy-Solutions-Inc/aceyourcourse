# 07 — Card editor in the Admin

**What to build:** Editors add, edit, reorder and delete single cards in a Topic's deck, with a live formula preview and "Save & add next". They make the deck Visible or Hidden and flag it Free Preview.

- **The deck screen:** in Member App content, from the Topic. It shows:
  - the card list in order
  - the deck's state (Hidden or Visible)
  - Free Preview
  - the card count
- **The card form:**
  - fields: front, back, note, and an optional back image (upload or replace)
  - a live preview that renders the maths as Members will see it
  - "Save" and "Save & add next"
- **Reorder** (up or down) and **delete** (with a confirmation). Deleting a card removes its Card Marks.
- **Visibility:** "Visible" is refused while the deck is empty ("Add a card first"). Hidden decks never show in the Member App.
- **Free Preview:** a switch per deck.
- **Every change** goes in Staff Activity, using the existing conflict check where two Editors edit at once.

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Content model"; stories 125, 127, 128.

- [ ] An Editor adds a card with maths, sees the preview, and uses "Save & add next".
- [ ] They reorder and delete cards, and the Member App deck follows once Visible.
- [ ] They make the deck Visible and Free Preview, and a Member with no pass can open it.
- [ ] **Sad paths, each with a test:**
  - making an empty deck Visible is refused
  - a formula that won't render is shown in the preview and refused on save
  - an empty front or back is refused
  - an over-long field is refused
  - an image of the wrong type or size is refused
  - a stale edit hits the conflict check
  - deleting the last card of a Visible deck makes it Hidden, or is refused (the prompt settles which, consistently)
  - Members can't post the editor actions
