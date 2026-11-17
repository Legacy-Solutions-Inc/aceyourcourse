import { formatDate, manilaDate } from "@/lib/manila-time";
import type { ActiveDevice } from "@/services/member.types";

// The Active Device screens (spec, Phase 3 → Active Device; stories 107, 108,
// 133f): outside the shell, like sign-in and consent. "Session ended" is the
// mockup's `session` screen (BUILD-MAP §3, "Signed out elsewhere"); "Use the
// Member App on this device" isn't in the mockup, so it borrows that card.
// Both are plain forms, so they work before any JavaScript loads.

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Pure: when a device was claimed, in Manila: "Today, 9:42 PM" on the same
 * Manila day as `now`, otherwise "16 Nov 2026, 9:42 PM".
 */
export function claimedAtLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  // Some ICU versions put a narrow no-break space before AM/PM.
  const time = clock.format(at).replace(/\s/g, " ");
  const day = manilaDate(at);
  return day === manilaDate(now) ? `Today, ${time}` : `${formatDate(day)}, ${time}`;
}

/** The card both screens share: a coloured bar, then the body. */
function DeviceCard({
  bar,
  barClassName,
  children,
}: {
  bar: string;
  barClassName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ayc-sand p-6">
      <div className="flex w-full max-w-[440px] flex-col border-[1.5px] bg-ayc-paper shadow-hard-lg">
        <p
          className={`border-b-[1.5px] px-4.5 py-3 font-mono text-xs font-bold tracking-[0.06em] ${barClassName}`}
        >
          {bar}
        </p>
        <div className="flex flex-col gap-4 p-5.5 pb-6">{children}</div>
      </div>
    </main>
  );
}

/** The dashed, monospaced line naming a device: "NEW DEVICE · Chrome on Android · Today, 9:42 PM". */
function DeviceLine({ label, device, now }: { label: string; device: ActiveDevice; now: Date }) {
  return (
    <p className="border-t border-dashed border-ayc-rule pt-3 font-mono text-xs leading-[1.6] text-muted-foreground">
      {label} · {device.deviceLabel} · {claimedAtLabel(device.claimedAt, now)}
    </p>
  );
}

const PRIMARY =
  "flex min-h-13 w-full cursor-pointer items-center justify-center border-[1.5px] bg-primary px-4 text-base font-bold text-primary-foreground";

interface SessionEndedProps {
  /** The signed-in Member's email. */
  email: string;
  /** The device that replaced this one: the Member's Active Device now. */
  newDevice: ActiveDevice | null;
  /** The time of this request, for "Today". */
  now: Date;
  /** The sanitised `next`: where to go once this device is active again. */
  next: string;
  /** The support email: the contact email in Settings. */
  contactEmail: string;
  /** Why the last "Sign in on this device" didn't go on, in words. */
  problem: string | null;
  /** "Sign in on this device": Google sign-in, which claims this device on return. */
  action: (formData: FormData) => Promise<void>;
}

/**
 * "Session ended" (story 107): this device was replaced, because the Member
 * signed in on another one. "Sign in on this device" signs in again and makes
 * this device active (story 108).
 */
export function SessionEnded({
  email,
  newDevice,
  now,
  next,
  contactEmail,
  problem,
  action,
}: SessionEndedProps) {
  return (
    <DeviceCard bar="SESSION ENDED" barClassName="bg-ayc-orange">
      <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        You were signed in on another device
      </h1>
      <p className="text-base leading-normal">
        Your account <b className="wrap-anywhere">{email}</b> was just opened on another device, so
        this one was signed out. Only one device can be active at a time.
      </p>
      {newDevice ? <DeviceLine label="NEW DEVICE" device={newDevice} now={now} /> : null}
      {problem ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {problem}
        </p>
      ) : null}
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={PRIMARY}>
          Sign in on this device
        </button>
      </form>
      <a
        href={`mailto:${contactEmail}`}
        className="flex min-h-11 items-center justify-center text-[15px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        Wasn’t you? Email support
      </a>
    </DeviceCard>
  );
}

interface UseThisDeviceProps {
  /** The signed-in Member's email. */
  email: string;
  /** The Member's Active Device now, on another device; null before their first claim. */
  activeDevice: ActiveDevice | null;
  /** The time of this request, for "Today". */
  now: Date;
  /** The sanitised `next`: where to go once this device is active. */
  next: string;
  /** "Use the Member App on this device": claims this device. */
  action: (formData: FormData) => Promise<void>;
  /** The Member App's sign-out Server Action, for someone who'd rather not. */
  signOutAction: () => Promise<void>;
}

/**
 * "Use the Member App on this device" (story 133f): signed in (through the
 * Admin, say) on a device that has never been the Member's Active Device. One
 * tap claims it, without signing in to Google again; the screen says first
 * which device that replaces, so none is replaced without the Member knowing.
 */
export function UseThisDevice({
  email,
  activeDevice,
  now,
  next,
  action,
  signOutAction,
}: UseThisDeviceProps) {
  return (
    <DeviceCard bar="ONE DEVICE AT A TIME" barClassName="bg-ayc-blue text-ayc-cream">
      <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        Use the Member App on this device?
      </h1>
      <p className="text-base leading-normal">
        You’re signed in as <b className="wrap-anywhere">{email}</b>, but the Member App isn’t
        active on this device yet. Only one device can use it at a time.
      </p>
      {activeDevice ? (
        <>
          <p className="text-[15px] leading-normal">
            It’s active on another device now. Using it here signs that device out of the Member
            App.
          </p>
          <DeviceLine label="ACTIVE NOW" device={activeDevice} now={now} />
        </>
      ) : null}
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={PRIMARY}>
          Use the Member App on this device
        </button>
      </form>
      <form
        action={signOutAction}
        className="flex flex-wrap items-center justify-center gap-2 text-sm"
      >
        <span>Not now?</span>
        <button
          type="submit"
          className="min-h-11 cursor-pointer font-bold text-ayc-blue underline underline-offset-2"
        >
          Sign out
        </button>
      </form>
    </DeviceCard>
  );
}
