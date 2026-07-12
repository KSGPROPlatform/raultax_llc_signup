"use client";

import { useEffect, useState } from "react";

// True on phone-sized / touch-primary devices. Combines a width breakpoint with
// a coarse-pointer check so it reflects "is this a phone?" rather than just a
// narrow desktop window. SSR-safe: returns false until mounted (avoids hydration
// mismatch), then settles to the real value.
export function useIsMobile(maxWidthPx = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(
      `(max-width: ${maxWidthPx}px), (pointer: coarse)`,
    );
    const update = () => setIsMobile(mq.matches);
    update();
    // addEventListener("change") is the modern API; fall back for old Safari.
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [maxWidthPx]);

  return isMobile;
}
