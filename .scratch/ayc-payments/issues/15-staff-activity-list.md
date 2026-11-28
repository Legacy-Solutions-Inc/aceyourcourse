# 15 — Staff Activity list for Owners

**What to build:** Owners can read Staff Activity in the Admin: who changed what and when, including the automatic "PayMongo (system)" entries.

- **Where:** a read-only "Staff Activity" screen in Settings (Settings is already Owner-only), with its own link in the Settings section.
- **The list:** newest first, paged; each entry shows when (Manila time), who (Staff name and email, or "PayMongo (system)"), the area and what changed, using the details Staff Activity already records.
- **Filters:** by Staff member (including "PayMongo (system)") and by area.
- Nothing can be edited or deleted.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Spec: Phase 4 → "Orders Admin" (the Staff Activity list for Owners).

- [ ] An Owner sees the latest Staff Activity entries, newest first, and filters them by a Staff member.
- [ ] System entries from PayMongo show as "PayMongo (system)" once payments exist.
- [ ] **Sad paths, each with a test:**
  - an Editor is refused the screen and its data on the server
  - an empty filter result shows "No activity"
  - paging never repeats or skips an entry when new entries arrive
  - times are right in Manila time
