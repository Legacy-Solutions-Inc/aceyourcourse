# 06 — Card import

**What to build:** an Editor imports a Subject's flashcards from a spreadsheet (CSV) plus a zip of images. They see a preview with row-level errors before anything saves, then confirm. The decks arrive Hidden, and missing Topics are created.

- **The template:** downloadable. Columns: topic, front, back, note, image filename. Every text field is plain text with maths in `$...$` or `$$...$$`, and a literal dollar sign is `\$`.
- **The planner:** pure. CSV plus a zip listing go in. Out comes a preview of:
  - Topics to create (in order of first appearance, after existing Topics; matched by name)
  - cards to add, replace or keep per Topic
  - row errors, each naming the row and column:
    - a missing required field
    - a formula that won't render
    - an image filename not in the zip
    - an unsupported image type or size
    - an over-long field
- **The preview screen:** the counts per Topic, the errors (which block confirming), and a note when a Topic would be created because the name doesn't match an existing one ("did you rename it?").
- **Re-importing a Topic that has cards:** choose Replace or Add.
  - Replace keeps Card Marks on cards whose front text is unchanged, and removes the rest.
  - Add appends.
- **Confirming:**
  - saves everything in one go, or nothing
  - card images go to the private content bucket
  - new decks are Hidden
  - Staff Activity records the import (Topic counts, not every card)
- **Formula rendering:** KaTeX (or the renderer the prompt settles), shared with the Member App and the editor preview (ticket 07).

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Spreadsheet import", "Formula notation in every text field", "Card back images and quiz figures"; stories 118, 120–124, 133p.

- [ ] A valid CSV plus zip previews correctly, and confirming creates Topics and Hidden decks with their images.
- [ ] Re-importing with Replace keeps Card Marks on unchanged fronts. Add appends.
- [ ] The template downloads, and importing it unchanged succeeds.
- [ ] **Sad paths, each with a test:**
  - each row error type, with the row and column named
  - a CSV with a missing or extra header
  - an empty CSV
  - a file that isn't a CSV
  - a zip over the size limit or containing a path like `../x.png`
  - a formula such as `$\frac{1}{$` reported, not crashing
  - a literal `\$` accepted
  - confirming a preview with errors is refused on the server
  - a failure halfway saves nothing
  - Members can't post the import actions
