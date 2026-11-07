import { adminMode } from "@/lib/admin/mode";
import {
  readSampleUpload,
  receiveSampleUpload,
  type SampleUploadAnswer,
} from "@/services/uploads.mock";

// PUT and GET /api/dev/uploads/[id] (CONVENTIONS §2): the sample arm of the
// upload seam, held in memory. The browser PUTs a file once to the one-time
// URL createUpload gave it; the Website then loads it here. With sample data
// only; otherwise both answer 404, as if the route didn't exist.

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notFound = () => new Response("Not Found", { status: 404 });

const ANSWERS: Record<SampleUploadAnswer, { status: number; text: string }> = {
  stored: { status: 201, text: "Uploaded" },
  "not-found": { status: 404, text: "Not Found" },
  "bad-token": { status: 403, text: "This upload URL isn't valid" },
  "already-uploaded": { status: 409, text: "This upload URL has been used" },
  "wrong-type": { status: 415, text: "The file isn't the type declared" },
  "wrong-size": { status: 400, text: "The file isn't the size declared" },
  "not-an-image": { status: 415, text: "The file isn't a JPEG, PNG or WebP image" },
};

/**
 * Takes the file, once, when the token, type, size and first bytes all match.
 * The one-time token is the authorisation, as with a Supabase Storage signed
 * upload URL (ticket 17): only a Staff User's createUpload, which runs the
 * Staff Guard, hands it out, and it's compared in constant time.
 */
export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
  if (adminMode !== "sample") return notFound();
  const { id } = await params;
  const length = request.headers.get("content-length");
  const answer = await receiveSampleUpload(
    id,
    new URL(request.url).searchParams.get("token") ?? "",
    {
      contentType: request.headers.get("content-type"),
      contentLength: length === null ? null : Number(length),
      body: async () => new Uint8Array(await request.arrayBuffer()),
    },
  );
  const { status, text } = ANSWERS[answer];
  return new Response(text, { status });
}

/** Serves an uploaded file with its type. */
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  if (adminMode !== "sample") return notFound();
  const upload = readSampleUpload((await params).id);
  if (!upload) return notFound();
  return new Response(upload.bytes, {
    headers: {
      "content-type": upload.contentType,
      "content-length": String(upload.bytes.byteLength),
      // An upload never changes: a new file gets a new id.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
