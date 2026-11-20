// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewerPdfRun } from "@/services/admin.types";
import { createRunStarter } from "@/services/reviewer-pdf-runs";

// How a Reviewer PDF job's next run starts (ticket 12; ADR 0012). Live with
// CRON_SECRET (production), each run is its own call to the run endpoint, so
// each gets a function's full time; anywhere else (the sample data, local,
// e2e) the runs go on in the server's own process, one after another.

const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";
const RUN_URL = "https://www.aceyourcourse.ph/api/reviewer-pdfs/run";
const SECRET = "0123456789abcdef0123456789abcdef";

const runs = (...outcomes: ReviewerPdfRun[]) => {
  const run = vi.fn<(id: string) => Promise<ReviewerPdfRun>>();
  for (const outcome of outcomes) run.mockResolvedValueOnce(outcome);
  return run;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("starting a run, live with the secret", () => {
  it("asks the run endpoint for it, with the secret, and runs nothing here", async () => {
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    const run = runs();
    const start = createRunStarter({ secret: SECRET, live: true, runUrl: RUN_URL, send, run });

    await start(ID);

    expect(send).toHaveBeenCalledWith(RUN_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ id: ID }),
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("logs, and never throws, when the endpoint refuses or can't be reached", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const refusing = createRunStarter({
      secret: SECRET,
      live: true,
      runUrl: RUN_URL,
      send: async () => new Response(null, { status: 401 }),
      run: runs(),
    });
    await expect(refusing(ID)).resolves.toBeUndefined();
    expect(error).toHaveBeenLastCalledWith(
      `The Reviewer PDF job's run endpoint answered 401; the cron restarts the job:`,
      ID,
    );

    const unreachable = createRunStarter({
      secret: SECRET,
      live: true,
      runUrl: RUN_URL,
      send: async () => {
        throw new Error("fetch failed");
      },
      run: runs(),
    });
    await expect(unreachable(ID)).resolves.toBeUndefined();
    expect(error).toHaveBeenLastCalledWith(
      "Couldn't reach the Reviewer PDF job's run endpoint; the cron restarts the job:",
      ID,
      expect.any(Error),
    );
  });
});

describe("starting a run without the secret, or on the sample data", () => {
  it("warns, live with no secret, that nothing restarts a job that stops", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await createRunStarter({ live: true, runUrl: RUN_URL, send: vi.fn(), run: runs("done") })(ID);
    expect(warn).toHaveBeenCalledWith(
      "CRON_SECRET isn't set: this Reviewer PDF job runs in this function, and nothing restarts it if it stops:",
      ID,
    );

    warn.mockClear();
    await createRunStarter({ live: false, runUrl: RUN_URL, send: vi.fn(), run: runs("done") })(ID);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["live with no secret", { secret: undefined, live: true }],
    ["on the sample data, even with one", { secret: SECRET, live: false }],
  ])("runs every batch here, %s, until the job needs no more", async (_, settings) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn();
    const run = runs("more", "more", "done");
    const start = createRunStarter({ ...settings, runUrl: RUN_URL, send, run });

    await start(ID);

    expect(run.mock.calls).toEqual([[ID], [ID], [ID]]);
    expect(send).not.toHaveBeenCalled();
  });

  it("stops at a failed or stopped run", async () => {
    for (const last of ["failed", "stopped"] as const) {
      const run = runs("more", last);
      await createRunStarter({ live: false, runUrl: RUN_URL, send: vi.fn(), run })(ID);
      expect(run).toHaveBeenCalledTimes(2);
    }
  });

  it("logs, and never throws, when a run fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => {
      throw new Error("out of memory");
    });

    await expect(
      createRunStarter({ live: false, runUrl: RUN_URL, send: vi.fn(), run })(ID),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "A Reviewer PDF job's run failed; it stays Processing:",
      ID,
      expect.any(Error),
    );
  });
});
