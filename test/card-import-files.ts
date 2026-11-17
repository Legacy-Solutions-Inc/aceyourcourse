import { zipSync } from "fflate";

import type { StaffActor } from "@/services/admin.types";
import { createContentUpload, receiveSampleUpload } from "@/services/uploads.mock";
import type { ContentUploadPurpose, ContentUploadTicket } from "@/services/uploads.types";

/** The card import template's header row. */
export const IMPORT_HEADER = "topic,front,back,note,image";

/** A CSV file's bytes: the header, then each row. */
export const importCsv = (rows: string[], header = IMPORT_HEADER) =>
  new TextEncoder().encode([header, ...rows].join("\n"));

/** A zip of the files, by their paths inside it. */
export const importZip = (files: Record<string, Uint8Array>) => zipSync(files);

/** An import's files, as a test hands them to an arm to upload. */
export interface ImportFiles {
  csv: Uint8Array;
  zip?: Uint8Array | null;
  /** False: ask for the upload URLs, but never send the files, as when an upload hasn't finished. */
  send?: boolean;
}

/** The paths an import sends, once its files are uploaded. */
export interface ImportPaths {
  csv: string;
  zip: string | null;
}

export const IMPORT_UPLOADER: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

/** Uploads one private file through an upload arm's createContentUpload, and the PUT the browser makes. */
export async function uploadContent(
  create: (
    purpose: ContentUploadPurpose,
    size: number,
  ) => Promise<{ ok: true; value: ContentUploadTicket } | { ok: false }>,
  put: (ticket: ContentUploadTicket, bytes: Uint8Array) => Promise<boolean>,
  purpose: ContentUploadPurpose,
  bytes: Uint8Array,
  send: boolean,
): Promise<string> {
  const created = await create(purpose, bytes.byteLength);
  if (!created.ok) throw new Error(`The ${purpose} upload was refused`);
  if (send && !(await put(created.value, bytes))) throw new Error(`The ${purpose} wasn't stored`);
  return created.value.path;
}

/** Uploads an import's files to the sample data, as the import screen does. */
export async function uploadSampleImport({ csv, zip = null, send = true }: ImportFiles) {
  const create = (purpose: ContentUploadPurpose, size: number) =>
    createContentUpload(IMPORT_UPLOADER, { purpose, size });
  const put = async (ticket: ContentUploadTicket, bytes: Uint8Array) => {
    const url = new URL(ticket.uploadUrl, "http://localhost");
    const answer = await receiveSampleUpload(
      url.pathname.split("/").at(-1) ?? "",
      url.searchParams.get("token") ?? "",
      { contentType: ticket.contentType, contentLength: bytes.byteLength, body: async () => bytes },
    );
    return answer === "stored";
  };
  return {
    csv: await uploadContent(create, put, "card-import-csv", csv, send),
    zip: zip ? await uploadContent(create, put, "card-import-zip", zip, send) : null,
  } satisfies ImportPaths;
}
