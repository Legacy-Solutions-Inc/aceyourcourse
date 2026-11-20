import type { ActiveDevice, Member } from "@/services/member.types";

interface AccountProfileProps {
  member: Pick<Member, "name" | "email">;
  /** The Member's Active Device: this one, since every Account request is from it. */
  device: ActiveDevice | null;
  /** The Member App's sign-out Server Action. */
  signOutAction: () => Promise<void>;
}

/**
 * Account's Profile (mockup L599–604; story 110): the Member's name and email
 * from Google, nothing to edit, the device they're signed in on, and Sign
 * out, which returns to the sign-in screen.
 */
export function AccountProfile({ member, device, signOutAction }: AccountProfileProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[17px] font-extrabold wrap-anywhere">
          {member.name ?? member.email}
        </span>
        <span className="font-mono text-xs wrap-anywhere text-muted-foreground">
          {member.email} · Google
        </span>
      </p>
      {device ? (
        <p className="text-sm">Signed in on this device only · {device.deviceLabel}</p>
      ) : null}
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex min-h-11 cursor-pointer items-center border-[1.5px] border-destructive px-4 text-[15px] font-bold text-destructive"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
