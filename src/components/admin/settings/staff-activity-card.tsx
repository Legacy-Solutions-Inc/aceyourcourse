import Link from "next/link";

import { paths } from "@/paths";

/** Settings' way to Staff Activity (Phase 4, ticket 15), shown under the Admin accounts. */
export function StaffActivityCard() {
  return (
    <section
      aria-labelledby="settings-staff-activity"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <h2
        id="settings-staff-activity"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        STAFF ACTIVITY
      </h2>
      <p className="text-sm leading-normal">
        Who changed what in the Admin, and when, including PayMongo’s automatic changes.
      </p>
      <Link
        href={paths.admin.staffActivity}
        className="flex min-h-10 w-fit items-center border-[1.5px] px-4 text-sm font-bold hover:bg-ayc-sand"
      >
        Open Staff Activity
      </Link>
    </section>
  );
}
