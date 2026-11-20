import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { sampleContentFiles } from "@/services/uploads.mock";

import { imageBytes } from "../../../../../../test/image-bytes";
import { GET } from "./route";

// The sample data's signed card image URLs (ticket 08), standing in for
// Storage's: the Member seam hands one out with an allowed deck read, and it
// serves the image until it expires, about 10 minutes later. Outside sample
// mode it answers 404.
const mode = vi.hoisted(() => ({ current: "sample" as "sample" | "closed" }));
vi.mock("@/lib/admin/mode", () => ({
  get adminMode() {
    return mode.current;
  },
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const PATH = "decks/0b8f4b8e-6a2f-4b1e-9d3c-5e7f9a1b2c3d/1c9e2f4a-7b3d-4e5f-8a6b-9c0d1e2f3a4b.png";
const PNG = imageBytes("image/png");

/** Signs the stored image for 10 minutes, as the Member seam does, and gives the URL's token. */
async function signed(): Promise<string> {
  const urls = await sampleContentFiles.signedUrls([PATH], 600);
  const token = urls[PATH]?.split("/").at(-1);
  if (!token) throw new Error("Not signed");
  return decodeURIComponent(token);
}

const get = (token: string) =>
  GET(new Request(`http://localhost/api/dev/card-images/${token}`), {
    params: Promise.resolve({ token }),
  });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  mode.current = "sample";
  resetSampleStore();
  await sampleContentFiles.put(PATH, PNG, "image/png");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/dev/card-images/[token]", () => {
  it("serves the card image while its URL is good, kept only by this browser", async () => {
    const response = await get(await signed());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=600");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("lets the browser keep it only for the URL's life left", async () => {
    const token = await signed();
    vi.setSystemTime(BOOT.getTime() + 7 * 60 * 1000);

    expect((await get(token)).headers.get("cache-control")).toBe("private, max-age=180");
  });

  it("stops working the instant the URL expires, 10 minutes on", async () => {
    const token = await signed();

    vi.setSystemTime(BOOT.getTime() + 10 * 60 * 1000 - 1);
    expect((await get(token)).status).toBe(200);
    vi.setSystemTime(BOOT.getTime() + 10 * 60 * 1000);
    expect((await get(token)).status).toBe(404);
  });

  it("forgets expired URLs as new ones are signed", async () => {
    await signed();
    vi.setSystemTime(BOOT.getTime() + 11 * 60 * 1000);
    await signed();

    expect(Object.keys(getSampleStore().signedFiles)).toHaveLength(1);
  });

  it.each(["a-token-never-handed-out", "constructor", "__proto__"])(
    "answers 404 for %j",
    async (token) => {
      expect((await get(token)).status).toBe(404);
    },
  );

  it("answers 404 once the image is deleted", async () => {
    const token = await signed();
    await sampleContentFiles.remove([PATH]);

    expect((await get(token)).status).toBe(404);
  });

  it("signs nothing for an image that isn't stored", async () => {
    expect(await sampleContentFiles.signedUrls(["decks/x/missing.png"], 600)).toEqual({});
  });

  it("answers 404 outside sample mode", async () => {
    const token = await signed();
    mode.current = "closed";

    expect((await get(token)).status).toBe(404);
  });
});
