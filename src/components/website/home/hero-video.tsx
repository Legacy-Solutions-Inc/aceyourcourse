"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { homeCopy, promoVideo } from "@/content/home";
import { REDUCED_MOTION, useMediaQuery, WIDE_SCREEN } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const copy = homeCopy.hero;

/** Save-Data: the Visitor has asked the browser to use less data. */
function saveDataOn(): boolean {
  const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
  return connection?.saveData === true;
}

/**
 * The hero's backdrop: the promo video behind the hero content. The server
 * sends only the poster. Once the browser is known, a wide screen plays the
 * video as a muted, looping background, unless the Visitor prefers reduced
 * motion or has Save-Data on, with a button to pause it. Otherwise no video
 * bytes download until they tap "Play video", which opens a player with
 * controls under the hero content.
 */
export function HeroVideo({ children }: { children: React.ReactNode }) {
  const wide = useMediaQuery(WIDE_SCREEN);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const [playing, setPlaying] = useState(false);
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const backgroundVideo = useRef<HTMLVideoElement>(null);

  // Both are null on the server and while hydrating.
  const browserKnown = wide !== null && reducedMotion !== null;
  const playsInBackground = browserKnown && wide && !reducedMotion && !saveDataOn() && !playing;

  const toggleBackground = () => {
    const video = backgroundVideo.current;
    if (!video) return;
    if (backgroundPaused) {
      // A refused play() leaves it paused; the button still offers to resume.
      void video.play()?.catch(() => setBackgroundPaused(true));
    } else {
      video.pause();
    }
    setBackgroundPaused(!backgroundPaused);
  };

  // The Play button goes away, so keyboard focus moves to the player.
  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-0">
        <Image
          src={promoVideo.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {playsInBackground ? (
          <video
            ref={backgroundVideo}
            src={promoVideo.src}
            poster={promoVideo.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(100deg,rgb(14_26_46/0.96)_0%,rgb(14_26_46/0.88)_42%,rgb(14_26_46/0.55)_75%,rgb(14_26_46/0.4)_100%)]"
      />
      <div className="relative">{children}</div>
      {playsInBackground ? (
        // Moving for longer than 5 s, so it can be paused (WCAG 2.2.2). Placed
        // over the hero's bottom padding, so it never shifts the layout.
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-324 justify-end px-[clamp(20px,5vw,72px)] pb-4">
            <button
              type="button"
              onClick={toggleBackground}
              className="pointer-events-auto flex min-h-11 cursor-pointer items-center gap-2 px-1.5 font-mono text-xs font-bold tracking-[0.06em] text-ayc-cream uppercase focus-visible:outline-ayc-cream"
            >
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-ayc-cream text-[10px]"
              >
                {backgroundPaused ? "▶" : "❚❚"}
              </span>
              {backgroundPaused ? copy.playBackground : copy.pauseBackground}
            </button>
          </div>
        </div>
      ) : (
        // Until the browser is known, a wide screen hides the row, so it
        // doesn't flash before the background video takes over.
        <div
          className={cn(
            "relative mx-auto max-w-324 px-[clamp(20px,5vw,72px)] pb-[clamp(40px,5vw,64px)]",
            !browserKnown && "wide:hidden",
          )}
        >
          {playing ? (
            <video
              ref={player}
              src={promoVideo.src}
              poster={promoVideo.poster}
              controls
              autoPlay
              playsInline
              tabIndex={0}
              aria-label={copy.videoLabel}
              className="aspect-video w-full max-w-180 border-[1.5px] border-ayc-cream bg-ayc-navy focus-visible:outline-ayc-cream"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="flex min-h-12 cursor-pointer items-center gap-2.5 text-[15px] font-bold text-ayc-cream focus-visible:outline-ayc-cream"
            >
              <span
                aria-hidden="true"
                className="flex size-8.5 items-center justify-center rounded-full border-[1.5px] border-ayc-cream pl-0.5 text-[11px]"
              >
                ▶
              </span>
              {copy.playVideo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
