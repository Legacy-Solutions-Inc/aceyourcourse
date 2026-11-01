"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useTransition } from "react";

import type { AdminAction, AdminActionState } from "@/lib/admin/action";

/**
 * Runs the Admin accounts' Server Actions. Each call sends only its input: the
 * staff list's rules decide, not the conflict check. After every answer the
 * screen reads the staff list again, so it shows what the server now holds,
 * including an Invite someone else already cancelled.
 */
export function useStaffAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: AdminAction<T>,
    input: unknown,
    onAnswer: (state: AdminActionState<T>) => void,
  ) {
    startTransition(async () => {
      let state: AdminActionState<T>;
      try {
        state = await action({ status: "idle" }, { input });
      } catch (error) {
        // A redirect from the Staff Guard isn't a failure: let Next follow it.
        unstable_rethrow(error);
        state = { status: "failed" };
      }
      onAnswer(state);
      router.refresh();
    });
  }

  return { pending, run };
}
