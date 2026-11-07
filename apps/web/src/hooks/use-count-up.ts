import { type RefObject, useEffect, useRef, useState } from "react";

const DURATION = 700;

/**
 * Counts a number up from zero the first time it scrolls into view.
 *
 * The server render is the real total — the state starts at `target`, so there
 * is never a `0` or an `undefined` in the HTML. The reset to zero happens in
 * the first frame after mount, and the browser only paints the latest state,
 * so the count starts without a flash.
 */
export function useCountUp(target: number | undefined): {
  ref: RefObject<HTMLSpanElement | null>;
  value: number | undefined;
} {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState<number | undefined>(target);

  useEffect(() => {
    if (target === undefined) {
      return;
    }

    const node = ref.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!node || reduced || typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    let frame = 0;
    let started: number | null = null;
    let observer: IntersectionObserver | null = null;

    const step = (now: number) => {
      started ??= now;
      const t = Math.min(1, (now - started) / DURATION);
      // ease-out cubic: fast off the line, settles on the total
      setValue(Math.round((1 - (1 - t) ** 3) * target));
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer?.disconnect();
        observer = null;
        setValue(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [target]);

  return { ref, value };
}
