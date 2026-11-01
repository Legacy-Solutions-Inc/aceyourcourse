import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictNotice } from "./conflict-notice";

// The conflict check's notice (spec, Phase 2 → Conflict check), in Manila time
// whatever the browser's own time zone is.
describe("ConflictNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T16:05:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names who saved first, and when, with the date for an earlier day", () => {
    render(
      <ConflictNotice
        savedBy="Kim Reyes"
        savedAt="2026-10-21T09:15:00+08:00"
        what="these settings"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kim Reyes saved these settings at 9:15 AM on 21 Oct 2026. Copy your changes, then reload to see theirs.",
    );
  });

  it("says the record changed when nobody saved it, as after a Reset", () => {
    render(
      <ConflictNotice savedBy={null} savedAt="2026-10-22T15:00:00+08:00" what="these settings" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "These settings changed at 3:00 PM. Copy your changes, then reload to see the new version.",
    );
  });
});
