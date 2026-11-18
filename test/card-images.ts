import { type CardImageType, MAX_CARD_IMAGE_BYTES } from "@/lib/cards/card-rules";
import type { StaffActor } from "@/services/admin.types";
import { GET as sampleCardImage } from "@/app/api/dev/card-images/[token]/route";
import { getSampleStore } from "@/services/mock/sample-store";
import { createContentUpload } from "@/services/uploads.mock";
import type { ContentUploadTicket } from "@/services/uploads.types";

/** The Staff User who uploads card images in the tests. */
export const IMAGE_UPLOADER: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

/** How a test uploads a card's back image (ticket 07). */
export interface CardImageUpload {
  /** The type the browser says it is: PNG unless given. */
  contentType?: CardImageType;
  /** False: ask for the upload URL, but never send the file, as when an upload hasn't finished. */
  send?: boolean;
}

/**
 * The size the browser declares when it asks for the upload URL: the file's
 * own, held to what the seam allows, so a test can send more than it said,
 * as a forged upload could (Storage's bucket takes up to 200 MB).
 */
export const declaredSize = (bytes: Uint8Array) =>
  Math.max(1, Math.min(bytes.byteLength, MAX_CARD_IMAGE_BYTES));

/**
 * Uploads a card image to the sample data through the upload seam, and gives
 * the path a save sends. The file is stored as given, skipping the upload
 * route's own checks, as Storage's bucket takes any image, CSV or zip it's
 * sent: what a save then refuses is the save's own doing.
 */
export async function uploadSampleCardImage(
  bytes: Uint8Array,
  { contentType = "image/png", send = true }: CardImageUpload = {},
): Promise<string> {
  const created = await createContentUpload(IMAGE_UPLOADER, {
    purpose: "card-image",
    contentType,
    size: declaredSize(bytes),
  });
  if (!created.ok) throw new Error("The card image upload was refused");
  if (send) storeSampleUpload(created.value, bytes);
  return created.value.path;
}

/** Puts the file at a sample upload, as if the browser had sent it. */
function storeSampleUpload(ticket: ContentUploadTicket, bytes: Uint8Array): void {
  const id = new URL(ticket.uploadUrl, "http://localhost").pathname.split("/").at(-1) ?? "";
  const store = getSampleStore();
  const upload = store.uploads[id];
  if (!upload) throw new Error("The sample upload isn't there");
  store.uploads = { ...store.uploads, [id]: { ...upload, bytes } };
}

/**
 * Loads a card image from the signed URL a Member was handed (ticket 08), as
 * their browser would: the sample data's through its development-only route,
 * Storage's over the network. Null when it doesn't load (expired, say).
 */
export async function loadCardImage(url: string): Promise<Uint8Array | null> {
  const sample = url.match(/^\/api\/dev\/card-images\/([^/?]+)$/);
  const response = sample
    ? await sampleCardImage(new Request(`http://localhost${url}`), {
        params: Promise.resolve({ token: decodeURIComponent(sample[1] ?? "") }),
      })
    : await fetch(url);
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}
