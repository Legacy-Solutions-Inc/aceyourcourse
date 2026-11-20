---
type: "query"
date: "2026-11-16T17:15:58.001044+00:00"
question: "How does one Staff save travel from an Admin editor through adminAction, the Staff Guard and the write pipeline to the database, and where does code differ from CONVENTIONS.md and the ADRs?"
contributor: "graphify"
source_nodes:
  ["adminAction()", "requireStaff()", "onDatabase()", "stampedWrite()", "callAdminAction()"]
---

# Q: How does one Staff save travel from an Admin editor through adminAction, the Staff Guard and the write pipeline to the database, and where does code differ from CONVENTIONS.md and the ADRs?

## Answer

Editor hook (useInstantSave/useAdminForm) -> callAdminAction -> adminAction (requireStaff, roleRefusal, zod, requiresStamp) -> AdminService selector (isDatabaseConfigured ? databaseArm : mockImpl) -> databaseArm write/stampedWrite -> onDatabase (advisory lock per part, load all tables, run sample-arm writeCatalogue over stand-in store, diff + syncTables, saveStamps optimistic UPDATE on record_stamps, Staff Activity last, Storage cleanup after commit) -> revalidateTag. Divergence: DB arm reuses sample-arm code via withStandInStore instead of per-table UPDATE WHERE updated_at; stamps live in record_stamps; every write loads the whole catalogue.

## Source Nodes

- adminAction()
- requireStaff()
- onDatabase()
- stampedWrite()
- callAdminAction()
