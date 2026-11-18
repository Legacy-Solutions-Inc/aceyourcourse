// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// The Reviewer PDF job's endpoints (ticket 12; ADR 0012): POST …/run does one
// run of a job after answering, and starts the next when pages are left; GET
// …/cron (Vercel Cron, every minute) restarts the jobs whose runs have
// stopped. Both are for the server itself and Vercel Cron only: without the
// server's CRON_SECRET as a bearer token they're refused, and while the
// server has none they don't exist. The seam and the run starter are
// replaced: what's checked here is who gets through, and what starts.

const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";
const SECRET = "0123456789abcdef0123456789abcdef";

const { runReviewerPdfJob, restartStaleReviewerPdfJobs, startReviewerPdfRun, pending, secret } =
  vi.hoisted(() => ({
    runReviewerPdfJob: vi.fn(),
    restartStaleReviewerPdfJobs: vi.fn(),
    startReviewerPdfRun: vi.fn(),
    pending: [] as (() => Promise<void>)[],
    secret: { current: undefined as string | undefined },
  }));
// The server's CRON_SECRET, as each test sets it.
vi.mock("@/env.server", async (original) => ({
  ...(await original<typeof import("@/env.server")>()),
  isDatabaseConfigured: false,
  get serverEnv() {
    return { CRON_SECRET: secret.current };
  },
}));
vi.mock("@/services/admin", () => ({ runReviewerPdfJob, restartStaleReviewerPdfJobs }));
vi.mock("@/services/reviewer-pdf-runs", async (original) => ({
  ...(await original<typeof import("@/services/reviewer-pdf-runs")>()),
  startReviewerPdfRun,
  pageRenderer: { open: vi.fn() },
}));
// What `after` schedules runs when the test says, as after the response.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    pending.push(task);
  },
}));

async function routes(cronSecret: string | undefined) {
  secret.current = cronSecret;
  return {
    run: (await import("./run/route")).POST,
    cron: (await import("./cron/route")).GET,
  };
}

const runRequest = (authorization: string | null, body: unknown = { id: ID }) =>
  new Request("http://localhost:3000/api/reviewer-pdfs/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization === null ? {} : { authorization }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const cronRequest = (authorization: string | null) =>
  new Request("http://localhost:3000/api/reviewer-pdfs/cron", {
    headers: authorization === null ? {} : { authorization },
  });

async function afterTheResponse() {
  for (const task of pending.splice(0)) await task();
}

afterEach(() => {
  pending.length = 0;
  vi.clearAllMocks();
});

describe("the run endpoint", () => {
  it("answers at once, then runs the job, starting the next run while pages are left", async () => {
    const { run } = await routes(SECRET);
    runReviewerPdfJob.mockResolvedValue("more");

    const answer = await run(runRequest(`Bearer ${SECRET}`));

    expect(answer.status).toBe(202);
    expect(runReviewerPdfJob).not.toHaveBeenCalled();
    await afterTheResponse();
    expect(runReviewerPdfJob).toHaveBeenCalledWith(ID, expect.anything());
    expect(startReviewerPdfRun).toHaveBeenCalledWith(ID);
  });

  it.each(["done", "failed", "stopped"])(
    "starts no other run after one that's %s",
    async (outcome) => {
      const { run } = await routes(SECRET);
      runReviewerPdfJob.mockResolvedValue(outcome);

      await run(runRequest(`Bearer ${SECRET}`));
      await afterTheResponse();

      expect(startReviewerPdfRun).not.toHaveBeenCalled();
    },
  );

  it("logs a run that fails, which the cron restarts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run } = await routes(SECRET);
    runReviewerPdfJob.mockRejectedValue(new Error("down"));

    await run(runRequest(`Bearer ${SECRET}`));
    await afterTheResponse();

    expect(error).toHaveBeenCalledWith(
      "A Reviewer PDF job's run failed; the cron restarts it:",
      ID,
      expect.any(Error),
    );
    expect(startReviewerPdfRun).not.toHaveBeenCalled();
  });

  it.each([
    ["no Authorization header", null],
    ["the wrong secret", `Bearer ${SECRET.replace("0", "1")}`],
    ["the secret without Bearer", SECRET],
  ])("refuses a caller with %s, running nothing", async (_, authorization) => {
    const { run } = await routes(SECRET);

    expect((await run(runRequest(authorization))).status).toBe(401);
    await afterTheResponse();
    expect(runReviewerPdfJob).not.toHaveBeenCalled();
  });

  it.each([
    ["no id", {}],
    ["an id that isn't one", { id: "../etc" }],
    ["a body that isn't JSON", "{"],
  ])("refuses a request with %s", async (_, body) => {
    const { run } = await routes(SECRET);
    expect((await run(runRequest(`Bearer ${SECRET}`, body))).status).toBe(400);
    expect(pending).toEqual([]);
  });

  it("isn't there while the server has no secret, whatever the caller sends", async () => {
    const { run } = await routes(undefined);

    expect((await run(runRequest("Bearer "))).status).toBe(404);
    expect((await run(runRequest(`Bearer ${SECRET}`))).status).toBe(404);
    expect(pending).toEqual([]);
  });
});

describe("the cron endpoint", () => {
  it("restarts the stale jobs, starting a run for each it restarted", async () => {
    const { cron } = await routes(SECRET);
    const other = "6f1d2c3b-4a59-4e8f-9d7c-1b2a3c4d5e6f";
    restartStaleReviewerPdfJobs.mockResolvedValue({ restarted: [ID, other], failed: ["x"] });

    const answer = await cron(cronRequest(`Bearer ${SECRET}`));

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ restarted: 2, failed: 1 });
    await afterTheResponse();
    expect(startReviewerPdfRun.mock.calls).toEqual([[ID], [other]]);
  });

  it("refuses a caller without the secret, restarting nothing", async () => {
    const { cron } = await routes(SECRET);

    expect((await cron(cronRequest(null))).status).toBe(401);
    expect((await cron(cronRequest("Bearer guess"))).status).toBe(401);
    expect(restartStaleReviewerPdfJobs).not.toHaveBeenCalled();
  });

  it("isn't there while the server has no secret", async () => {
    const { cron } = await routes(undefined);

    expect((await cron(cronRequest(`Bearer ${SECRET}`))).status).toBe(404);
    expect(restartStaleReviewerPdfJobs).not.toHaveBeenCalled();
  });
});

describe("Vercel Cron's schedule", () => {
  it("calls the cron endpoint every minute", async () => {
    const { readFileSync } = await import("node:fs");
    const { paths } = await import("@/paths");
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons?: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([{ path: paths.jobs.reviewerPdfCron, schedule: "* * * * *" }]);
  });
});
