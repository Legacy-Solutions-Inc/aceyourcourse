import { cn } from "@/lib/utils";

interface AuthScreenProps {
  /** The card's offset shadow: orange for sign-in, red for the 403 screen. */
  tone: "sign-in" | "denied";
  children: React.ReactNode;
}

/** The sign-in and 403 screens' frame (mockup 883–906): a cream card on navy. */
export function AuthScreen({ tone, children }: AuthScreenProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ayc-navy p-6">
      <div
        className={cn(
          "flex w-full flex-col border-[1.5px] border-ayc-cream bg-background p-8 shadow-hard-lg",
          tone === "sign-in"
            ? "max-w-[420px] gap-4.5 shadow-ayc-orange"
            : "max-w-[460px] gap-4 shadow-destructive",
        )}
      >
        {children}
      </div>
    </main>
  );
}
