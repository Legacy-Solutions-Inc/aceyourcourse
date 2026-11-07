import type { StaffActor } from "@/services/admin.types";

const ROLE_LABEL = { owner: "OWNER", editor: "EDITOR" } as const;

interface UserBlockProps {
  actor: StaffActor;
  /** The Admin's sign-out Server Action. */
  signOutAction: () => Promise<void>;
}

/** The signed-in Staff User at the foot of the sidebar, with Sign out (mockup 31–35). */
export function UserBlock({ actor, signOutAction }: UserBlockProps) {
  return (
    <div className="mt-auto flex flex-col gap-1.5 border-t-[1.5px] pt-3.5">
      <p className="text-sm font-bold">{actor.name}</p>
      <p className="font-mono text-[11px] wrap-anywhere text-muted-foreground">{actor.email}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="bg-primary px-1.5 py-1.25 font-mono text-[10px] leading-none font-bold text-primary-foreground">
          {ROLE_LABEL[actor.role]}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 cursor-pointer items-center text-[13px] font-bold text-destructive hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
