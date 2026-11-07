import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";

export type SpotlightHandlers = {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
};

/**
 * Tracks the pointer inside one element as two percentage custom properties
 * (`--mx` / `--my`), read by the `.row-spotlight` gradient in `app.css`.
 *
 * The position is never React state: a `pointermove` only records the last
 * coordinates and schedules one `requestAnimationFrame`, so a burst of moves
 * inside a frame collapses into a single style write and no re-render. The
 * layout read happens inside the frame, after the browser has already done
 * the work for that frame.
 */
export function useSpotlight<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  handlers: SpotlightHandlers;
} {
  const ref = useRef<T | null>(null);
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, []);

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const node = ref.current;
    if (!node) {
      return;
    }

    point.current = { x: event.clientX, y: event.clientY };
    if (frame.current !== null) {
      return;
    }

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const target = ref.current;
      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      target.style.setProperty(
        "--mx",
        `${((point.current.x - rect.left) / rect.width) * 100}%`,
      );
      target.style.setProperty(
        "--my",
        `${((point.current.y - rect.top) / rect.height) * 100}%`,
      );
    });
  }

  function onPointerLeave() {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    const node = ref.current;
    node?.style.removeProperty("--mx");
    node?.style.removeProperty("--my");
  }

  return { handlers: { onPointerLeave, onPointerMove }, ref };
}
