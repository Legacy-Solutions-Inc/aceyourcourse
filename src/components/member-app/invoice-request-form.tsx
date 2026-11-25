"use client";

import { useActionState, useId, useMemo, useState } from "react";

import type { InvoiceFormState } from "@/app/app/(shell)/billing/actions";
import { cn } from "@/lib/utils";

const IDLE: InvoiceFormState = { error: null, fields: {} };

const INPUT =
  "min-h-11 w-full min-w-0 border-[1.5px] bg-white px-3 py-2 text-[15px] font-normal aria-invalid:border-destructive";

/** "Request official invoice"'s Server Action, given the Order's reference first. */
export type InvoiceRequestAction = (
  reference: string,
  previous: InvoiceFormState,
  formData: FormData,
) => Promise<InvoiceFormState>;

interface InvoiceRequestFormProps {
  /** The Paid Order the invoice is for. */
  reference: string;
  /** The Member's name, which the name on the invoice starts as. */
  defaultName: string;
  /** The request Server Action. */
  action: InvoiceRequestAction;
}

/**
 * "Request official invoice"'s short form (Phase 4, ticket 08; story 151j):
 * the name on the invoice, prefilled from the Member's name, the address, and
 * a TIN for businesses (optional). Each field's message shows under it; a
 * refusal for the Order shows above the button. The action decides: once the
 * request is made, the page says "Invoice requested" in the form's place.
 */
export function InvoiceRequestForm({ reference, defaultName, action }: InvoiceRequestFormProps) {
  const bound = useMemo(() => action.bind(null, reference), [action, reference]);
  const [state, formAction, pending] = useActionState(bound, IDLE);
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState("");
  const [tin, setTin] = useState("");
  const id = useId();

  const fields = [
    {
      key: "name",
      label: "Name on the invoice",
      value: name,
      set: setName,
      autoComplete: "name",
    },
    {
      key: "address",
      label: "Address",
      value: address,
      set: setAddress,
      autoComplete: "street-address",
    },
    {
      key: "tin",
      label: "TIN (optional, for businesses)",
      value: tin,
      set: setTin,
      autoComplete: "off",
    },
  ] as const;

  return (
    <form
      action={formAction}
      aria-label={`Request official invoice for ${reference}`}
      className="flex flex-col gap-3"
    >
      {fields.map((field) => {
        const error = state.fields[field.key];
        const inputId = `${id}-${field.key}`;
        const errorId = `${inputId}-error`;
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-bold">
              {field.label}
            </label>
            <input
              id={inputId}
              name={field.key}
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              required={field.key !== "tin"}
              autoComplete={field.autoComplete}
              inputMode={field.key === "tin" ? "numeric" : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={INPUT}
            />
            {error ? (
              <p id={errorId} className="text-[13px] font-semibold text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "min-h-11 cursor-pointer self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground",
          pending && "cursor-wait opacity-70",
        )}
      >
        {pending ? "Requesting…" : "Request invoice"}
      </button>
    </form>
  );
}
