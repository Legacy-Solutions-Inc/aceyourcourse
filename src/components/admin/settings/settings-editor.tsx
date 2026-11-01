"use client";

import { type ReactNode, useState } from "react";

import { AdminTextField } from "@/components/admin/admin-text-field";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { SaveState } from "@/components/admin/save-state";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import { formatAsOfDate, formatChangedOn } from "@/lib/admin/time";
import type { AdminWebsiteSettings, RecordStamp } from "@/services/admin.types";

type SettingsAction = AdminAction<AdminWebsiteSettings>;

interface SettingsEditorProps {
  initial: AdminWebsiteSettings;
  actions: {
    saveContactEmail: SettingsAction;
    saveLinks: SettingsAction;
    saveTrustFigures: SettingsAction;
  };
  /** ADMIN ACCOUNTS, shown under the links (mockup 694–699). */
  accounts?: ReactNode;
}

/**
 * Settings (mockup 678–702; BUILD-MAP §3.11): the contact email, the store and
 * social links, and the trust figures, each saved on its own. They are one
 * record with one stamp, so each part's save hands the new stamp to the
 * others, and while one part is saving the others wait for it: saving the
 * email and then the links is never a conflict.
 */
export function SettingsEditor({ initial, actions, accounts }: SettingsEditorProps) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(0);
  const shared = {
    savedAt: settings.stamp.savedAt,
    onSaved: setSettings,
    busy: saving > 0,
    onSaving: (started: boolean) => setSaving((count) => count + (started ? 1 : -1)),
  };

  return (
    <div className="flex max-w-250 flex-col gap-4.5">
      <LastChanged stamp={settings.stamp} />
      <div className="grid items-start gap-4.5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4.5">
          <ContactEmailForm initial={initial} action={actions.saveContactEmail} {...shared} />
          <TrustFiguresForm
            initial={initial}
            asOf={settings.values.shopStats.asOf}
            action={actions.saveTrustFigures}
            {...shared}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4.5">
          <LinksForm initial={initial} action={actions.saveLinks} {...shared} />
          {accounts}
        </div>
      </div>
    </div>
  );
}

/** "LAST CHANGED 14 OCT 2026 BY ANGEL ROSE L. LEPAÑA" (mockup 684). */
function LastChanged({ stamp }: { stamp: RecordStamp }) {
  return (
    <p className="font-mono text-[11px] text-muted-foreground">
      {stamp.savedBy
        ? `LAST CHANGED ${formatChangedOn(stamp.savedAt)} BY ${stamp.savedBy.toUpperCase()}`
        : "NOT CHANGED IN THE ADMIN YET"}
    </p>
  );
}

interface PartProps {
  initial: AdminWebsiteSettings;
  action: SettingsAction;
  savedAt: string;
  onSaved: (saved: AdminWebsiteSettings) => void;
  busy: boolean;
  onSaving: (saving: boolean) => void;
}

type FormParts = Pick<
  ReturnType<typeof useAdminForm>,
  "formProps" | "status" | "errorMessage" | "conflict" | "canSave"
>;

/** One part of Settings: a card with its heading, fields and save row (mockup 680–700). */
function SettingsPart({
  title,
  description,
  form,
  saveLabel,
  savedMessage,
  children,
}: {
  title: string;
  description: string;
  form: FormParts;
  saveLabel: string;
  savedMessage: string;
  children: React.ReactNode;
}) {
  const headingId = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <form
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
      {...form.formProps}
    >
      <h2
        id={headingId}
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        {title}
      </h2>
      <p className="text-sm leading-normal">{description}</p>
      {children}
      {form.conflict ? <ConflictNotice {...form.conflict} what="these settings" /> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="submit"
          disabled={!form.canSave}
          className="min-h-10 cursor-pointer border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-wait"
        >
          {saveLabel}
        </button>
        <SaveState
          status={form.status}
          savedMessage={savedMessage}
          errorMessage={form.errorMessage}
        />
      </div>
    </form>
  );
}

const linkText = (link: string | null) => link ?? "";

function ContactEmailForm({ initial, ...options }: PartProps) {
  const form = useAdminForm({
    ...options,
    initialValues: { contactEmail: initial.values.contactEmail },
    valuesFrom: ({ values }) => ({ contactEmail: values.contactEmail }),
    title: "Contact email",
    invalidMessage: "FIX THE EMAIL ADDRESS FIRST",
  });
  return (
    <SettingsPart
      title="CONTACT EMAIL"
      description="Every “email us” link on the website opens an email to this address: the footer, the FAQ page, product pages and the legal pages."
      form={form}
      saveLabel="Save"
      savedMessage="✓ SAVED · LIVE ON THE SITE"
    >
      <AdminTextField
        label="EMAIL ADDRESS"
        type="email"
        inputMode="email"
        autoComplete="off"
        emphasis
        error={form.fieldError("contactEmail")}
        {...form.text("contactEmail")}
      />
    </SettingsPart>
  );
}

const LINK_FIELDS = [
  ["shopLinks.shopee", "SHOPEE"],
  ["shopLinks.lazada", "LAZADA"],
  ["shopLinks.tiktok", "TIKTOK SHOP"],
  ["socialLinks.tiktok", "TIKTOK PROFILE"],
  ["socialLinks.facebook", "FACEBOOK"],
  ["socialLinks.instagram", "INSTAGRAM"],
] as const;

function linkValues({ values }: AdminWebsiteSettings) {
  const { shopLinks, socialLinks } = values;
  return {
    shopLinks: {
      shopee: linkText(shopLinks.shopee),
      lazada: linkText(shopLinks.lazada),
      tiktok: linkText(shopLinks.tiktok),
    },
    socialLinks: {
      tiktok: linkText(socialLinks.tiktok),
      facebook: linkText(socialLinks.facebook),
      instagram: linkText(socialLinks.instagram),
    },
  };
}

function LinksForm({ initial, ...options }: PartProps) {
  const form = useAdminForm({
    ...options,
    initialValues: linkValues(initial),
    valuesFrom: linkValues,
    title: "Store & social links",
    invalidMessage: "FIX THE LINKS MARKED IN RED",
  });
  return (
    <SettingsPart
      title="STORE & SOCIAL LINKS"
      description="Used for every store button unless a product has its own link, and for the social links in the footer."
      form={form}
      saveLabel="Save links"
      savedMessage="✓ SAVED · EVERY STORE BUTTON UPDATED"
    >
      {LINK_FIELDS.map(([path, label]) => (
        <AdminTextField
          key={path}
          label={label}
          type="url"
          inputMode="url"
          autoComplete="off"
          error={form.fieldError(path)}
          {...form.text(path)}
        />
      ))}
      <p className="font-mono text-[11px] text-muted-foreground">
        AN EMPTY LINK HIDES THAT BUTTON OR LINK
      </p>
    </SettingsPart>
  );
}

function trustValues({ values }: AdminWebsiteSettings) {
  const { rating, ratingCount, followers } = values.shopStats;
  return { shopStats: { rating: String(rating), ratingCount: String(ratingCount), followers } };
}

function TrustFiguresForm({ initial, asOf, ...options }: PartProps & { asOf: string }) {
  const form = useAdminForm({
    ...options,
    initialValues: trustValues(initial),
    valuesFrom: trustValues,
    title: "Trust figures",
    invalidMessage: "FIX THE FIGURES MARKED IN RED",
  });
  return (
    <SettingsPart
      title="TRUST FIGURES"
      description="The shop’s figures from its Shopee page, in the website’s trust line: the footer, and the Home, About and Reviews pages."
      form={form}
      saveLabel="Save figures"
      savedMessage="✓ SAVED · LIVE ON THE SITE"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminTextField
          label="RATING"
          inputMode="decimal"
          autoComplete="off"
          error={form.fieldError("shopStats.rating")}
          {...form.text("shopStats.rating")}
        />
        <AdminTextField
          label="NO. OF RATINGS"
          inputMode="numeric"
          autoComplete="off"
          error={form.fieldError("shopStats.ratingCount")}
          {...form.text("shopStats.ratingCount")}
        />
        <AdminTextField
          label="FOLLOWERS"
          autoComplete="off"
          error={form.fieldError("shopStats.followers")}
          {...form.text("shopStats.followers")}
        />
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        AS OF {formatAsOfDate(asOf)} · SAVING SETS IT TO TODAY
      </p>
    </SettingsPart>
  );
}
