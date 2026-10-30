import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroVideo } from "./hero-video";

// The hero's promo video (spec: Media; BUILD-MAP §7). The server sends only
// the poster. On a wide screen it then plays as a muted background loop,
// unless the Visitor prefers reduced motion or has Save-Data on. Anywhere
// else nothing downloads until they tap "Play video".

interface Environment {
  wide?: boolean;
  reducedMotion?: boolean;
  saveData?: boolean;
}

function setEnvironment({ wide = true, reducedMotion = false, saveData }: Environment = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        (query === "(min-width: 47.5rem)" && wide) ||
        (query === "(prefers-reduced-motion: reduce)" && reducedMotion),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: saveData === undefined ? undefined : { saveData },
  });
}

const hero = (
  <HeroVideo>
    <h1>Remember every formula on board day.</h1>
  </HeroVideo>
);

const video = () => document.querySelector("video");
const playButton = () => screen.queryByRole("button", { name: "Play video" });

describe("HeroVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "connection");
  });

  it("sends the poster and a Play video button from the server, with no video", () => {
    const html = renderToString(hero);
    expect(html).not.toContain("<video");
    expect(html).not.toContain(".mp4");
    expect(html).toContain("ayc-promo-poster.webp");
    expect(html).toContain("Play video");
    expect(html).toContain("Remember every formula on board day.");
  });

  it("plays a muted, looping background video on a wide screen", () => {
    setEnvironment();
    render(hero);
    const background = video();
    expect(background).not.toBeNull();
    expect(background).toHaveAttribute("src", "/media/ayc-promo-720p.mp4");
    expect(background).toHaveAttribute("autoplay");
    expect(background).toHaveAttribute("loop");
    expect(background).toHaveAttribute("playsinline");
    expect(background).toHaveAttribute("preload", "auto");
    expect(background).toHaveAttribute("poster", "/media/ayc-promo-poster.webp");
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).not.toHaveAttribute("controls");
    expect(background?.muted).toBe(true);
    expect(playButton()).toBeNull();
  });

  it("lets the Visitor pause and resume the background video", async () => {
    setEnvironment();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const user = userEvent.setup();
    render(hero);

    await user.click(screen.getByRole("button", { name: "Pause background video" }));
    expect(pause).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Play background video" }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pause background video" })).toBeInTheDocument();
    pause.mockRestore();
    play.mockRestore();
  });

  it("downloads nothing below 760 px until the Visitor taps Play video", async () => {
    setEnvironment({ wide: false });
    const user = userEvent.setup();
    render(hero);
    expect(video()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Play video" }));

    const player = video();
    expect(player).toHaveAttribute("src", "/media/ayc-promo-720p.mp4");
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("autoplay");
    expect(player).toHaveAttribute("playsinline");
    expect(player).not.toHaveAttribute("loop");
    expect(player).not.toHaveAttribute("aria-hidden");
    expect(player?.muted).toBe(false);
    expect(player).toHaveAccessibleName("Ace Your Course promo video");
    expect(player).toHaveFocus();
    expect(playButton()).toBeNull();
  });

  it("doesn't autoplay for a Visitor who prefers reduced motion", async () => {
    setEnvironment({ reducedMotion: true });
    const user = userEvent.setup();
    render(hero);
    expect(video()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Play video" }));
    expect(video()).toHaveAttribute("controls");
  });

  it("doesn't autoplay with Save-Data on", () => {
    setEnvironment({ saveData: true });
    render(hero);
    expect(video()).toBeNull();
    expect(playButton()).toBeInTheDocument();
  });

  it("autoplays when the browser reports Save-Data off", () => {
    setEnvironment({ saveData: false });
    render(hero);
    expect(video()).toHaveAttribute("autoplay");
  });

  it("renders the hero content over the video", () => {
    setEnvironment();
    render(hero);
    expect(
      screen.getByRole("heading", { level: 1, name: "Remember every formula on board day." }),
    ).toBeInTheDocument();
  });
});
