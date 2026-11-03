"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminSwitch } from "@/components/admin/admin-switch";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { CountedField, TextField, ToggleRow } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import { promoBannerFormValues } from "@/lib/admin/promo-form";
import { dayMonth, type PromoStatus, type PromoStatusKind } from "@/lib/admin/promo-status";
import { cn } from "@/lib/utils";
import { PROMO_BUTTON_LABEL_MAX, PROMO_TEXT_MAX } from "@/services/admin.schema";
import type { AdminPromoBanner } from "@/services/admin.types";

import { INVALID, InfoNote } from "./exam-page-editors";

// ─────────────────────────────────────────────────────────────────────────────
// The Home promo banner (mockup 969–973; BUILD-MAP §3.2): its status line,
// the Show banner switch, which saves at once, and the form: BANNER TEXT,
// BUTTON LABEL, LINK, STARTS ON and ENDS ON. The banner shows on Home only
// within its dates and turns off by itself after the end date, so nobody has
// to be there to end a sale. Turning it off while it's on Home asks first
// (BUILD-MAP §2, unpublish).
// ─────────────────────────────────────────────────────────────────────────────

const SAVED = "✓ SAVED · LIVE ON HOME";

const STATUS_COLOURS: Record<PromoStatusKind, string> = {
  on: "text-ayc-success",
  scheduled: "text-ayc-blue",
  ended: "text-muted-foreground",
  off: "text-muted-foreground",
};

export interface PromoBannerActions {
  save: AdminAction<AdminPromoBanner>;
  setVisible: AdminAction<AdminPromoBanner>;
}

interface PromoBannerEditorProps {
  opened: AdminPromoBanner;
  /** Where the saved banner is now, from the Website's own rule, worked out on the server. */
  status: PromoStatus;
  actions: PromoBannerActions;
}

export function PromoBannerEditor({ opened, status, actions }: PromoBannerEditorProps) {
  const router = useRouter();
  const [stamp, setStamp] = useState(opened.stamp);
  const [confirming, setConfirming] = useState(false);
  const form = useAdminForm({
    action: actions.save,
    initialValues: promoBannerFormValues(opened.banner),
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminPromoBanner) => promoBannerFormValues(saved.banner),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      router.refresh();
    },
    title: "The Home promo banner",
    invalidMessage: INVALID,
  });
  const { values, change, fieldError } = form;
  const live = status.kind === "on";

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-muted-foreground">
        Strip at the top of Home · off until the next sale
      </p>
      <p className={cn("font-mono text-[11px] font-bold", STATUS_COLOURS[status.kind])}>
        <span className="sr-only">Status: </span>
        {status.line}
      </p>
      <BannerSwitch
        visible={opened.banner?.visible ?? false}
        saved={opened.banner !== null}
        action={actions.setVisible}
        onTurnOff={live ? () => setConfirming(true) : undefined}
      />
      <form aria-label="Home promo banner" className="flex flex-col gap-3.5" {...form.formProps}>
        <CountedField
          label="BANNER TEXT"
          max={PROMO_TEXT_MAX}
          placeholder="Like “11.11 SALE · Any 2 reviewers, 4% off on Shopee”"
          value={values.text}
          onChange={(text) => change("text", text)}
          error={fieldError("text")}
        />
        <CountedField
          label="BUTTON LABEL"
          max={PROMO_BUTTON_LABEL_MAX}
          placeholder="Like “Shop the sale”"
          value={values.buttonLabel}
          onChange={(buttonLabel) => change("buttonLabel", buttonLabel)}
          error={fieldError("buttonLabel")}
        />
        <TextField
          label="LINK"
          inputMode="url"
          placeholder="https://shopee.ph/aceyourcourse or /products"
          value={values.href}
          onChange={(href) => change("href", href)}
          error={fieldError("href")}
        />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <AdminTextField
            label="STARTS ON"
            type="date"
            {...form.text("startDate")}
            error={fieldError("startDate")}
          />
          <AdminTextField
            label="ENDS ON"
            type="date"
            {...form.text("endDate")}
            error={fieldError("endDate")}
          />
        </div>
        <InfoNote>
          The banner turns off by itself after the end date. Everything else on Home is fixed.
        </InfoNote>
        {form.conflict ? <ConflictNotice {...form.conflict} what="the banner" /> : null}
        <EditorSaveRow
          saveLabel="Save"
          savedMessage={SAVED}
          form={form}
          extra={
            live ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
              >
                Turn off banner now
              </button>
            ) : null
          }
        />
      </form>
      {opened.banner ? (
        <TurnOffBanner
          open={confirming}
          onOpenChange={setConfirming}
          text={opened.banner.text}
          endDate={opened.banner.endDate}
          action={actions.setVisible}
        />
      ) : null}
    </div>
  );
}

interface BannerSwitchProps {
  visible: boolean;
  /** Whether the Website has a banner yet: one that hasn't been saved can't be shown. */
  saved: boolean;
  action: AdminAction<AdminPromoBanner>;
  /** Asks before turning off a banner that's on Home now; undefined turns it off at once. */
  onTurnOff?: () => void;
}

/** Show banner: a single toggle, saved at once with no conflict check. */
function BannerSwitch({ visible, saved, action, onTurnOff }: BannerSwitchProps) {
  const [shown, show] = useOptimistic(visible);
  const { save, pending } = useInstantSave(action, {
    what: "The banner’s switch",
    kept: "The switch is back as it was.",
    refused: (error) =>
      error.kind === "invalid" && error.formError
        ? error.formError
        : "The banner wasn’t changed. Reload the page and try again.",
  });

  return (
    <ToggleRow
      label="Show banner"
      hint={saved ? "Home shows it between its dates" : "Save the banner first"}
    >
      {(ids) => (
        <AdminSwitch
          checked={shown}
          disabled={!saved}
          onCheckedChange={(next) => {
            if (!next && onTurnOff) onTurnOff();
            else save({ visible: next }, () => show(next));
          }}
          aria-busy={pending || undefined}
          className="disabled:cursor-not-allowed disabled:opacity-50"
          {...ids}
        />
      )}
    </ToggleRow>
  );
}

interface TurnOffBannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  endDate: string;
  action: AdminAction<AdminPromoBanner>;
}

/** The unpublish confirmation (BUILD-MAP §2; mockup 1576), then the switch turned off. */
function TurnOffBanner({ open, onOpenChange, text, endDate, action }: TurnOffBannerProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(action, { input: { visible: false } });
      if (state.status === "saved") {
        onOpenChange(false);
        toast("✓ TURNED OFF · THE BANNER IS OFF HOME");
        router.refresh();
      } else if (state.status === "failed") {
        setError("COULDN’T TURN IT OFF · CHECK YOUR CONNECTION AND TRY AGAIN");
      } else if (state.status === "refused") {
        setError("NOT TURNED OFF · RELOAD THE PAGE AND TRY AGAIN");
      }
    });
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        setError(undefined);
        onOpenChange(next);
      }}
      tag="TURN OFF BANNER"
      tone="warning"
      title={`Turn off the “${text}” banner now?`}
      description={`It disappears from Home right away instead of on ${dayMonth(endDate)}. The text stays saved, so you can reuse it for the next sale.`}
    >
      {error ? (
        <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <AdminDialogButtons>
        <AdminDialogButton onClick={() => onOpenChange(false)}>Cancel</AdminDialogButton>
        <AdminDialogButton
          variant="primary"
          onClick={confirm}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          Turn off banner
        </AdminDialogButton>
      </AdminDialogButtons>
    </AdminDialog>
  );
}
