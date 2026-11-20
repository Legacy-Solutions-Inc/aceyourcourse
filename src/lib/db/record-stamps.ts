import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import type { RecordStamp } from "@/services/admin.types";

// A record's save stamp (CONVENTIONS §3: the conflict check), set by the
// database arms whose editors save a stamped record in their own transaction:
// the card editor's cards (ticket 07), the quiz screen's settings and
// questions (tickets 09 and 10) and a Reviewer PDF's placement (ticket 13).

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Sets a record's stamp, as the save's own transaction. */
export async function setStamp(tx: Transaction, record: string, stamp: RecordStamp): Promise<void> {
  const row = { record, updatedAt: new Date(stamp.savedAt), updatedBy: stamp.savedBy };
  await tx
    .insert(schema.recordStamps)
    .values(row)
    .onConflictDoUpdate({
      target: schema.recordStamps.record,
      set: { updatedAt: row.updatedAt, updatedBy: row.updatedBy },
    });
}
