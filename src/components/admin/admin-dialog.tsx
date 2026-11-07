"use client";

import type { ComponentProps, ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The coloured bar's tone: red to remove or delete, orange to cancel, blue to add. */
export type AdminDialogTone = "danger" | "warning" | "info";

const BARS: Record<AdminDialogTone, string> = {
  danger: "bg-destructive text-white",
  warning: "bg-ayc-orange text-ayc-navy",
  info: "bg-ayc-blue text-ayc-cream",
};

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The bar's mono label, e.g. "REMOVE ADMIN". */
  tag: string;
  tone: AdminDialogTone;
  title: string;
  /** The sentence under the title, read out as the dialog's description. */
  description?: ReactNode;
  children?: ReactNode;
  onOpenAutoFocus?: ComponentProps<typeof DialogContent>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
}

/**
 * The Admin's modal, in the mockup's style (mockup 912–941; BUILD-MAP §2): a
 * coloured bar with its label, a bold title, the body and its buttons. It is a
 * Radix dialog, so it traps focus, and Escape or the scrim closes it.
 */
export function AdminDialog({
  open,
  onOpenChange,
  tag,
  tone,
  title,
  description,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: AdminDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        {...(description ? {} : { "aria-describedby": undefined })}
        className="max-w-[min(480px,calc(100%-2rem))] gap-0 rounded-none border-[1.5px] bg-background p-0 shadow-hard-lg sm:max-w-[min(480px,calc(100%-2rem))]"
      >
        <p
          className={cn(
            "border-b-[1.5px] px-4.5 py-3 font-mono text-xs font-bold tracking-[0.06em]",
            BARS[tone],
          )}
        >
          {tag}
        </p>
        <div className="flex min-w-0 flex-col gap-3 px-5 pt-5 pb-5.5">
          <DialogTitle className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.01em] wrap-anywhere">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[15px] leading-normal text-foreground">
              {description}
            </DialogDescription>
          ) : null}
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's button row: Cancel, then the action, on the right (mockup 919). */
export function AdminDialogButtons({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap justify-end gap-2">{children}</div>;
}

const BUTTONS = {
  plain: "bg-transparent text-foreground hover:bg-ayc-sand",
  primary: "bg-primary text-primary-foreground",
  danger: "bg-destructive text-white",
} as const;

/** One of the dialog's buttons. */
export function AdminDialogButton({
  variant = "plain",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTONS }) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-10.5 cursor-pointer border-[1.5px] px-4 text-sm font-bold disabled:cursor-wait",
        BUTTONS[variant],
        className,
      )}
      {...props}
    />
  );
}
