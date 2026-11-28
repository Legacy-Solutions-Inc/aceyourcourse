import {
  type RenewalDismissal,
  renewalDismissalDay,
  type RenewalReminder,
  renewalReminders,
} from "@/lib/member-app/renewal";
import type { AccessPass } from "@/services/content.types";
import { examCodeOf } from "@/services/member.rules";
import { memberUserIdSchema } from "@/services/member.schema";
import type { TargetExam } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The renewal reminders through the Member seam (Phase 4, ticket 12; spec,
// Phase 4 planning decisions → Renewal reminders; Testing Decisions → Phase 4
// seams), shared by both arms: each arm reads the Member's passes, Target
// Exams and dismissals, and keeps a dismissal, its own way (the RenewalStore
// below); the pure rule (src/lib/member-app/renewal.ts) decides which
// reminders show. A dismissal is kept per Member and Exam, for the Manila day
// it was made, on the server, so it holds on every device. Every call is
// scoped to the User id given, and throws for one that isn't a User id.
// ─────────────────────────────────────────────────────────────────────────────

/** What the renewal calls read and write, in each arm's own way. */
export interface RenewalStore {
  listAccessPasses(userId: string): Promise<AccessPass[]>;
  listTargetExams(userId: string): Promise<TargetExam[]>;
  /** The Member's dismissals: at most one per Exam, the latest. */
  readDismissals(userId: string): Promise<RenewalDismissal[]>;
  /** Keeps the Member's dismissal of an Exam's reminder for a Manila day, replacing an earlier one. */
  writeDismissal(userId: string, dismissal: RenewalDismissal, at: Date): Promise<void>;
}

/** Who's looking: Staff never get a reminder. */
export interface RenewalViewer {
  /** On the staff list now, and active (src/lib/member-app/access-check.ts). */
  activeStaff: boolean;
}

/** The Member seam's renewal calls, over an arm's store. */
export function renewalCalls(store: RenewalStore) {
  return {
    async listRenewalReminders(
      userId: string,
      { activeStaff }: RenewalViewer,
    ): Promise<RenewalReminder[]> {
      const wanted = memberUserIdSchema.parse(userId);
      const [passes, exams, dismissals] = await Promise.all([
        store.listAccessPasses(wanted),
        store.listTargetExams(wanted),
        store.readDismissals(wanted),
      ]);
      return renewalReminders({ passes, exams, dismissals, activeStaff, now: new Date() });
    },

    async dismissRenewalReminder(userId: string, examCode: string): Promise<boolean> {
      const wanted = memberUserIdSchema.parse(userId);
      const code = examCodeOf(examCode);
      // Only an Exam the Member holds a pass for can have a reminder to dismiss.
      const passes = await store.listAccessPasses(wanted);
      if (!passes.some((pass) => pass.examCode === code)) return false;
      const now = new Date();
      await store.writeDismissal(wanted, { examCode: code, day: renewalDismissalDay(now) }, now);
      return true;
    },
  };
}
