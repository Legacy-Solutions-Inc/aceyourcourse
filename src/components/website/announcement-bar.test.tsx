import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnnouncementBar } from "./announcement-bar";

const STORAGE_KEY = "ayc.announcement.dismissed";

const MESSAGES = [
  { text: "Physical copies on Shopee", href: "/products" },
  { text: "Ships from Iloilo City", href: "/faq" },
  { text: "Third message", href: "/about" },
];

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function currentMessage() {
  return screen.getByRole("link").textContent;
}

describe("AnnouncementBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the first message as a link, with a dismiss button", () => {
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);
    expect(screen.getByRole("link", { name: "Physical copies on Shopee" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("button", { name: "Dismiss announcement" })).toBeInTheDocument();
  });

  it("rotates to the next message every 4.5 s and wraps around", () => {
    vi.useFakeTimers();
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);

    act(() => vi.advanceTimersByTime(4499));
    expect(currentMessage()).toBe("Physical copies on Shopee");

    act(() => vi.advanceTimersByTime(1));
    expect(currentMessage()).toBe("Ships from Iloilo City");

    act(() => vi.advanceTimersByTime(4500 * 2));
    expect(currentMessage()).toBe("Physical copies on Shopee");
  });

  it("pauses while hovered and resumes after", async () => {
    // shouldAdvanceTime: RTL's async wrapper waits on a real setTimeout(0).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);

    await user.hover(screen.getByRole("link"));
    act(() => vi.advanceTimersByTime(4500 * 2));
    expect(currentMessage()).toBe("Physical copies on Shopee");

    await user.unhover(screen.getByRole("link"));
    act(() => vi.advanceTimersByTime(4500));
    expect(currentMessage()).toBe("Ships from Iloilo City");
  });

  it("pauses while focus is inside it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);

    await user.tab();
    expect(screen.getByRole("link")).toHaveFocus();
    act(() => vi.advanceTimersByTime(4500 * 2));
    expect(currentMessage()).toBe("Physical copies on Shopee");
  });

  it("does not rotate under reduced motion", () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);

    act(() => vi.advanceTimersByTime(4500 * 5));
    expect(currentMessage()).toBe("Physical copies on Shopee");
  });

  it("does not crash when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("hides when dismissed and remembers the announcement id", async () => {
    const user = userEvent.setup();
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);

    await user.click(screen.getByRole("button", { name: "Dismiss announcement" }));

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("a1");
  });

  it("stays hidden on a later visit when the same announcement was dismissed", () => {
    window.localStorage.setItem(STORAGE_KEY, "a1");
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows again when the announcement changed since it was dismissed", () => {
    window.localStorage.setItem(STORAGE_KEY, "a0");
    render(<AnnouncementBar id="a1" messages={MESSAGES} />);
    expect(screen.getByRole("link", { name: "Physical copies on Shopee" })).toBeInTheDocument();
  });

  it("still shows, and still dismisses for the visit, when storage is blocked", async () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    const user = userEvent.setup();

    render(<AnnouncementBar id="a1" messages={MESSAGES} />);
    expect(screen.getByRole("link")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss announcement" }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no messages", () => {
    const { container } = render(<AnnouncementBar id="a1" messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
