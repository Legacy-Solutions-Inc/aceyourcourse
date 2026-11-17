"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { putFile } from "@/components/admin/products/put-file";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import {
  importDeckLabel,
  importFileProblem,
  importProblemPlace,
  importTotals,
} from "@/lib/admin/card-import-view";
import type { ImportMode } from "@/lib/card-import/modes";
import { paths } from "@/paths";
import type { CardImportPreview, CardImportResult, CardImportTopic } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

export interface CardImportActions {
  createImportUpload: AdminAction<ContentUploadTicket>;
  checkCardImport: AdminAction<CardImportPreview>;
  importCards: AdminAction<CardImportResult>;
}

interface CardImportProps {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  actions: CardImportActions;
}

/** The uploaded files' paths, which checking and importing send. */
interface UploadedFiles {
  csv: string;
  zip: string | null;
}

type Step =
  | { kind: "choose" }
  | { kind: "preview"; files: UploadedFiles; preview: CardImportPreview }
  | { kind: "done"; result: CardImportResult };

/** The most problems the table lists; the rest are counted. */
const SHOWN_PROBLEMS = 100;

const BUTTON =
  "min-h-10 cursor-pointer border-[1.5px] px-3.5 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60";
const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";
const MODES: { mode: ImportMode; label: string; detail: string }[] = [
  {
    mode: "add",
    label: "Add",
    detail: "Put the new cards after the ones it has.",
  },
  {
    mode: "replace",
    label: "Replace",
    detail:
      "Make its deck the file’s cards. A card whose front is unchanged keeps Members’ progress; cards not in the file are removed.",
  },
];

/** A thrown failure with the message to show, rather than the generic one. */
class ImportStop extends Error {}

/** What a refused or failed check or import says, when it isn't about one file. */
function refusalText(state: AdminActionState<unknown>, what: "check" | "import"): string {
  if (state.status === "failed") {
    return what === "import"
      ? "COULDN’T IMPORT · NOTHING WAS SAVED · TRY AGAIN"
      : "COULDN’T CHECK THE FILE · CHECK YOUR CONNECTION AND TRY AGAIN";
  }
  if (state.status !== "refused") return "";
  const { error } = state;
  switch (error.kind) {
    case "invalid": {
      const field = Object.values(error.fieldErrors).flat()[0];
      return error.formError ?? field ?? "CHECK THE FILE AGAIN";
    }
    case "forbidden":
      return error.message;
    case "not-found":
      return "THAT EXAM OR SUBJECT IS GONE · GO BACK TO MEMBER APP CONTENT";
    case "conflict":
      return "THE TOPICS OR CARDS CHANGED SINCE YOU CHECKED THE FILE · CHECK IT AGAIN";
  }
}

/** Which uploaded files the server no longer has, when that's why it refused. */
function filesGone(state: AdminActionState<unknown>): { csv?: string; zip?: string } | null {
  if (state.status !== "refused" || state.error.kind !== "invalid") return null;
  const { csv, zip } = state.error.fieldErrors;
  return csv || zip ? { csv: csv?.[0], zip: zip?.[0] } : null;
}

/** A chosen file, as told apart from another: its name, size and when it was last changed. */
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/** What a refusal says, and whether it's a conflict, which offers to check the file again. */
const noticeOf = (state: AdminActionState<unknown>, what: "check" | "import") => ({
  text: refusalText(state, what),
  conflict: state.status === "refused" && state.error.kind === "conflict",
});

/** One Topic's row in the preview. */
function TopicRow({ topic, subject }: { topic: CardImportTopic; subject: string }) {
  const created = topic.topicId === null;
  return (
    <tr className="border-b border-ayc-ruled align-top last:border-b-0">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className="flex flex-col gap-1">
          <span className="text-sm font-bold wrap-anywhere">{topic.name}</span>
          {created ? (
            <>
              <span className="w-fit border border-ayc-orange px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.04em]">
                NEW TOPIC
              </span>
              <span className="text-xs leading-[1.45] text-muted-foreground">
                No Topic in {subject} is called this, so importing creates it.
                {topic.similarTo
                  ? ` Did you rename “${topic.similarTo}”? Use its current name to add to it.`
                  : ""}
              </span>
            </>
          ) : null}
          {topic.deck === "visible" ? (
            <span className="text-xs leading-[1.45] text-muted-foreground">
              Its deck is Visible: Members see these changes as soon as you import.
            </span>
          ) : null}
        </span>
      </th>
      <td className="py-2 pr-3 font-mono text-[11px] font-bold tracking-[0.04em]">
        {importDeckLabel(topic.deck)}
        {topic.mode === "replace" ? (
          <span className="block font-sans text-xs font-normal text-muted-foreground">Replace</span>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{topic.counts.add}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{topic.counts.replace}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{topic.counts.keep}</td>
      <td className="py-2 text-right tabular-nums">{topic.counts.remove}</td>
    </tr>
  );
}

/** The preview: each Topic's counts, then the problems, which block importing. */
function Preview({ preview }: { preview: CardImportPreview }) {
  const { topics, problems, subject } = preview;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] font-bold">{importTotals(preview)}</p>
      {topics.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className={`${LABEL} pb-2 text-left text-ayc-blue`}>CARDS PER TOPIC</caption>
            <thead>
              <tr className={`${LABEL} border-b-[1.5px] text-left`}>
                <th scope="col" className="py-1.5 pr-3">
                  TOPIC
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  GOES TO
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right">
                  ADD
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right">
                  REPLACE
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right">
                  KEEP
                </th>
                <th scope="col" className="py-1.5 text-right">
                  REMOVE
                </th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <TopicRow key={topic.name} topic={topic} subject={subject.code} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <div className="flex flex-col gap-2 border-[1.5px] border-destructive p-3.5">
          <h3 className={`${LABEL} text-destructive`}>
            {problems.length === 1
              ? "1 PROBLEM"
              : `${problems.length.toLocaleString("en")} PROBLEMS`}{" "}
            · FIX {problems.length === 1 ? "IT" : "THEM"} IN THE SPREADSHEET, THEN CHECK AGAIN
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <caption className="sr-only">Problems with the files</caption>
              <thead>
                <tr className={`${LABEL} border-b-[1.5px] text-left`}>
                  <th scope="col" className="py-1.5 pr-3">
                    WHERE
                  </th>
                  <th scope="col" className="py-1.5">
                    PROBLEM
                  </th>
                </tr>
              </thead>
              <tbody>
                {problems.slice(0, SHOWN_PROBLEMS).map((problem, index) => (
                  <tr
                    key={`${importProblemPlace(problem)}:${index}`}
                    className="border-b border-ayc-ruled align-top last:border-b-0"
                  >
                    <td className="py-1.5 pr-3 font-mono text-[11px] font-bold whitespace-nowrap">
                      {importProblemPlace(problem)}
                    </td>
                    <td className="py-1.5 wrap-anywhere">{problem.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {problems.length > SHOWN_PROBLEMS ? (
            <p className="text-xs text-muted-foreground">
              And {(problems.length - SHOWN_PROBLEMS).toLocaleString("en")} more. Fix these, then
              check the file again.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The success summary: each Topic the import changed, with where to see it. */
function Done({
  result,
  exam,
  subject,
  onAgain,
}: {
  result: CardImportResult;
  exam: CardImportProps["exam"];
  subject: CardImportProps["subject"];
  onAgain: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={`${LABEL} text-ayc-blue`}>✓ IMPORTED</p>
      <ul aria-label="Imported Topics" className="flex flex-col">
        {result.topics.map((topic) => {
          const { add, replace, remove } = topic.counts;
          const changes = [
            `${add} added`,
            replace > 0 ? `${replace} replaced` : null,
            remove > 0 ? `${remove} removed` : null,
          ].filter(Boolean);
          return (
            <li key={topic.topicId} className="border-b border-ayc-ruled py-2 last:border-b-0">
              <span className="font-bold">{topic.name}</span>
              {topic.created ? " · new Topic, with a Hidden deck" : ""} · {changes.join(", ")}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] leading-[1.45]">
        New decks are Hidden, so Members don’t see them until Staff make them Visible.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href={paths.admin.contentTopics(exam.code, subject.code)}
          className={`${BUTTON} inline-flex items-center bg-primary text-primary-foreground`}
        >
          See {subject.code}’s Topics
        </Link>
        <button type="button" onClick={onAgain} className={`${BUTTON} bg-ayc-paper`}>
          Import another file
        </button>
      </div>
    </div>
  );
}

/**
 * A Subject's card import (Phase 3, ticket 06; spec, Phase 3 → Spreadsheet
 * import; stories 118, 120–124, 133p): choose the CSV (and a zip of images),
 * which upload straight to the private content bucket, then "Check file" for
 * the preview: each Topic's counts, the Topics it would create, and every
 * problem with its row and column. "Import" stays off while there are
 * problems. The server checks everything again when importing, saves all of
 * it or nothing, and refuses if the Subject changed since the check.
 */
export function CardImport({ exam, subject, actions }: CardImportProps) {
  const form = useRef<HTMLFormElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [mode, setMode] = useState<ImportMode>("add");
  const [fileErrors, setFileErrors] = useState<{ csv?: string; zip?: string }>({});
  const [notice, setNotice] = useState<{ text: string; conflict: boolean } | null>(null);
  const uploaded = useRef<Partial<Record<"csv" | "zip", { file: string; path: string }>>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Uploads one file to the private content bucket, and gives its path. A
   * file already uploaded, unchanged, isn't sent again.
   */
  async function upload(file: File, kind: "csv" | "zip") {
    const what = kind.toUpperCase();
    const before = uploaded.current[kind];
    if (before?.file === fileKey(file)) return before.path;
    setProgress(`UPLOADING THE ${what} · 0%`);
    const ticket = await callAdminAction(actions.createImportUpload, {
      input: { purpose: `card-import-${kind}`, size: file.size },
    });
    if (ticket.status !== "saved") throw new ImportStop(refusalText(ticket, "check"));
    try {
      await putFile(
        ticket.value.uploadUrl,
        file,
        (sent) => setProgress(`UPLOADING THE ${what} · ${Math.round(sent * 100)}%`),
        ticket.value.contentType,
      );
    } catch {
      throw new ImportStop(`THE ${what} DIDN’T UPLOAD · CHECK YOUR CONNECTION AND TRY AGAIN`);
    }
    uploaded.current[kind] = { file: fileKey(file), path: ticket.value.path };
    return ticket.value.path;
  }

  /** The server no longer has the uploads: forget them, and ask for the files again. */
  function chooseAgain(errors: { csv?: string; zip?: string }) {
    uploaded.current = {};
    setStep({ kind: "choose" });
    setFileErrors(errors);
  }

  /** Checks the uploaded files, and shows the preview, or why it can't. */
  async function check(files: UploadedFiles, checkMode: ImportMode) {
    setProgress("CHECKING THE FILE…");
    const state = await callAdminAction(actions.checkCardImport, {
      input: { exam: exam.code, subject: subject.code, ...files, mode: checkMode },
    });
    setProgress(null);
    if (state.status === "saved") {
      setStep({ kind: "preview", files, preview: state.value });
      return;
    }
    const gone = filesGone(state);
    if (gone) chooseAgain(gone);
    else setNotice(noticeOf(state, "check"));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const csvFile = csvInput.current?.files?.[0] ?? null;
    const zipFile = zipInput.current?.files?.[0] ?? null;
    const errors = {
      csv: csvFile ? (importFileProblem(csvFile, "csv") ?? undefined) : "CHOOSE THE CSV FILE",
      zip: zipFile ? (importFileProblem(zipFile, "zip") ?? undefined) : undefined,
    };
    setFileErrors(errors);
    setNotice(null);
    if (errors.csv || errors.zip || !csvFile) return;

    startTransition(async () => {
      try {
        const files = {
          csv: await upload(csvFile, "csv"),
          zip: zipFile ? await upload(zipFile, "zip") : null,
        };
        await check(files, mode);
      } catch (error) {
        setProgress(null);
        const text =
          error instanceof ImportStop ? error.message : refusalText({ status: "failed" }, "check");
        setNotice({ text, conflict: false });
      }
    });
  }

  function changeMode(next: ImportMode) {
    setMode(next);
    if (step.kind !== "preview" || pending) return;
    const { files } = step;
    setNotice(null);
    startTransition(() => check(files, next));
  }

  function importNow() {
    if (step.kind !== "preview" || pending) return;
    const { files, preview } = step;
    setNotice(null);
    startTransition(async () => {
      setProgress("IMPORTING…");
      // The preview's own mode: the one it showed the counts for.
      const state = await callAdminAction(actions.importCards, {
        input: {
          exam: exam.code,
          subject: subject.code,
          ...files,
          mode: preview.mode,
          basedOn: preview.basedOn,
        },
      });
      setProgress(null);
      if (state.status === "saved") {
        uploaded.current = {};
        setStep({ kind: "done", result: state.value });
        toast(`✓ IMPORTED · ${subject.code}`);
        return;
      }
      const gone = filesGone(state);
      if (gone) chooseAgain(gone);
      else setNotice(noticeOf(state, "import"));
    });
  }

  /** A new file was chosen after a check: the preview no longer matches the files. */
  function startAgainKeepingFiles() {
    setStep({ kind: "choose" });
    setNotice(null);
  }

  function startAgain() {
    form.current?.reset();
    uploaded.current = {};
    setStep({ kind: "choose" });
    setFileErrors({});
    setNotice(null);
  }

  const preview = step.kind === "preview" ? step.preview : null;
  const blocked = !preview || preview.problems.length > 0 || preview.topics.length === 0;

  if (step.kind === "done") {
    return (
      <section
        aria-labelledby="card-import-heading"
        className="flex max-w-3xl min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
      >
        <h2 id="card-import-heading" className={`${LABEL} text-ayc-blue`}>
          {exam.code} · {subject.code} · IMPORT CARDS
        </h2>
        <Done result={step.result} exam={exam} subject={subject} onAgain={startAgain} />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="card-import-heading"
      className="flex max-w-3xl min-w-0 flex-col gap-4 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="card-import-heading" className={`${LABEL} text-ayc-blue`}>
          {exam.code} · {subject.code} · IMPORT CARDS
        </h2>
        <p className="text-sm">{subject.name}</p>
      </div>

      <div className="flex flex-col gap-1.5 border border-dashed border-ayc-rule p-3.5 text-[13px] leading-[1.5]">
        <p>
          One row per card, with the columns <b>topic, front, back, note, image</b>. Maths goes in{" "}
          <code>$...$</code>, or <code>$$...$$</code> on its own line; write a dollar sign as{" "}
          <code>\$</code>. <b>image</b> names a JPEG, PNG or WebP (up to 5 MB) in the zip. Topics
          are matched by name; a new name creates a Topic.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={paths.admin.cardImportTemplate}
            download
            className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
          >
            Download the template (CSV)
          </a>
          <a
            href={paths.admin.cardImportExampleImages}
            download
            className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
          >
            Its example image (zip)
          </a>
        </p>
      </div>

      <form ref={form} noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label htmlFor="card-import-csv" className={LABEL}>
            CSV FILE
          </label>
          <input
            ref={csvInput}
            id="card-import-csv"
            name="csv"
            type="file"
            accept=".csv,text/csv"
            aria-invalid={fileErrors.csv ? true : undefined}
            aria-describedby={fileErrors.csv ? "card-import-csv-error" : undefined}
            onChange={() => step.kind === "preview" && startAgainKeepingFiles()}
            className="text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:border-[1.5px] file:bg-ayc-paper file:px-3 file:font-bold"
          />
          {fileErrors.csv ? (
            <p id="card-import-csv-error" className={`${LABEL} text-destructive`}>
              {fileErrors.csv}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="card-import-zip" className={LABEL}>
            ZIP OF IMAGES (OPTIONAL)
          </label>
          <input
            ref={zipInput}
            id="card-import-zip"
            name="zip"
            type="file"
            accept=".zip,application/zip"
            aria-invalid={fileErrors.zip ? true : undefined}
            aria-describedby={fileErrors.zip ? "card-import-zip-error" : undefined}
            onChange={() => step.kind === "preview" && startAgainKeepingFiles()}
            className="text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:border-[1.5px] file:bg-ayc-paper file:px-3 file:font-bold"
          />
          {fileErrors.zip ? (
            <p id="card-import-zip-error" className={`${LABEL} text-destructive`}>
              {fileErrors.zip}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${LABEL} mb-1`}>IF A TOPIC ALREADY HAS CARDS</legend>
          {MODES.map((option) => (
            <label key={option.mode} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                value={option.mode}
                checked={mode === option.mode}
                disabled={pending}
                onChange={() => changeMode(option.mode)}
                className="mt-1 accent-ayc-blue"
              />
              <span>
                <b>{option.label}</b> · {option.detail}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON} ${preview ? "bg-ayc-paper" : "bg-primary text-primary-foreground"}`}
          >
            {preview ? "Check again" : "Check file"}
          </button>
          <p role="status" aria-live="polite" className={`${LABEL} text-muted-foreground`}>
            {progress ?? ""}
          </p>
        </div>
      </form>

      {notice ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 border-[1.5px] border-destructive px-3.5 py-3"
        >
          <p className={`${LABEL} text-destructive`}>{notice.text}</p>
          {notice.conflict && step.kind === "preview" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const { files } = step;
                setNotice(null);
                startTransition(() => check(files, mode));
              }}
              className={`${BUTTON} bg-ayc-paper`}
            >
              Check the file again
            </button>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <section
          aria-labelledby="card-import-preview"
          className="flex flex-col gap-3 border-t-[1.5px] pt-4"
        >
          <h2 id="card-import-preview" className={`${LABEL} text-ayc-blue`}>
            PREVIEW · NOTHING IS SAVED YET
          </h2>
          <Preview preview={preview} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={blocked || pending}
              aria-describedby={blocked ? "card-import-blocked" : undefined}
              onClick={importNow}
              className={`${BUTTON} bg-primary text-primary-foreground`}
            >
              Import
            </button>
            {blocked ? (
              <p id="card-import-blocked" className="text-[13px] text-muted-foreground">
                {preview.problems.length > 0
                  ? "Fix the problems first: nothing is imported while there are any."
                  : "The file has no cards to import."}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Everything is saved together, or nothing is. New decks are Hidden.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
