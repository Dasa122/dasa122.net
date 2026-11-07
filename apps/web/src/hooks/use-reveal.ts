import { type RefObject, useEffect, useRef } from "react";

/**
 * One observer for every revealed node on the page. Created lazily so a
 * server render never touches `IntersectionObserver`.
 */
let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const node = entry.target as HTMLElement;
        node.dataset.reveal = "in";
        observer?.unobserve(node);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
  );
  return observer;
}

/**
 * Opts an element into the page's scroll reveal. The attribute is set from an
 * effect, so a render without JavaScript shows the content immediately; the
 * stagger index becomes a small transition delay.
 *
 * Where the browser supports view timelines the element hands the work to
 * CSS (`reveal-vt`) instead of the observer: same entrance, no JavaScript in
 * the loop. Both paths start from a visible base state, so nothing is ever
 * stranded at `opacity: 0`.
 */
export function useReveal<T extends HTMLElement>(
  index = 0,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    node.dataset.reveal = "";
    node.style.setProperty("--reveal-i", String(index));

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      node.dataset.reveal = "in";
      return;
    }

    const viewTimeline =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("animation-timeline: view()");
    if (viewTimeline) {
      node.classList.add("reveal-vt");
      return () => {
        node.classList.remove("reveal-vt");
      };
    }

    // Anything already in the viewport reveals before the first paint; the
    // observer's first callback is a frame later, which would flash it hidden.
    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
    if (inView) {
      node.dataset.reveal = "in";
      return;
    }

    const io = sharedObserver();
    io.observe(node);

    return () => {
      io.unobserve(node);
    };
  }, [index]);

  return ref;
}
