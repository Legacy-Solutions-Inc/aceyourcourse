import { afterEach, describe, expect, it, vi } from "vitest";

// The PostHog client init is the boundary to an external SDK, so the SDK is
// replaced and the test checks the options handed to it: ADR 0009's cookieless,
// anonymous Website analytics, captured with no opt-in.
vi.mock("posthog-js", () => ({ default: { init: vi.fn() } }));

async function loadInstrumentation(key: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key);
  vi.resetModules();
  await import("./instrumentation-client");
  const { default: posthog } = await import("posthog-js");
  return vi.mocked(posthog.init);
}

describe("PostHog client init", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("does nothing when analytics is unconfigured", async () => {
    const init = await loadInstrumentation(undefined);
    expect(init).not.toHaveBeenCalled();
  });

  it("stores nothing on the device and captures without any opt-in", async () => {
    const init = await loadInstrumentation("phc_test");

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "/relay",
        persistence: "memory",
        autocapture: false,
        person_profiles: "identified_only",
        respect_dnt: true,
        disable_session_recording: true,
        disable_surveys: true,
      }),
    );
    expect(init).toHaveBeenCalledWith(
      "phc_test",
      expect.not.objectContaining({ opt_out_capturing_by_default: true }),
    );
  });
});
