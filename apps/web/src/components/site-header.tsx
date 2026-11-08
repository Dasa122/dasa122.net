import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { navigation } from "../lib/navigation";

const navLink =
  "border-b pb-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-ember hover:text-ember-text";

const MENU_ID = "site-menu";

// The panel is inert without JavaScript, so a phone gets plain links instead.
// Rendered as one string so React and the parser agree on what is inside the
// <noscript>; the class carries all of the styling (see app.css).
const fallbackNav = `<nav aria-label="Primary" class="fallback-nav">${navigation
  .map((item) => `<a href="${item.href}">${item.label}</a>`)
  .join("")}</nav>`;

export function SiteHeader({ name }: { name: string }) {
  // The server cannot see localStorage, and dark is now the default, so the
  // first render claims dark (and therefore offers "Light"). The effect reads
  // the real document class and corrects the label after mount.
  const [dark, setDark] = useState(true);
  // Always closed on the server: no hydration mismatch, and the panel is
  // absolutely positioned, so there is no layout shift either way.
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Widening past md hands navigation back to the inline nav.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const onChange = () => {
      if (desktop.matches) {
        setOpen(false);
      }
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage can be blocked; the class change still applies this session.
    }
  }

  return (
    <header className="site-header glass sticky top-0 z-40">
      <div className="mx-auto grid w-full max-w-[80rem] grid-cols-12 items-baseline gap-x-6 px-6 py-5 md:px-10">
        <Link
          className="col-span-9 font-display text-2xl leading-none tracking-[-0.01em] md:col-span-3"
          to="/"
        >
          {name}
        </Link>

        <nav
          aria-label="Primary"
          className="col-span-5 hidden flex-wrap justify-end gap-x-6 md:col-start-8 md:flex"
        >
          {navigation.map((item) => (
            <Link
              activeProps={{
                "aria-current": "page",
                className: "border-ember text-ember-text",
              }}
              className={navLink}
              inactiveProps={{ className: "border-transparent text-ink" }}
              key={item.href}
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
          <button
            aria-pressed={dark}
            className={`${navLink} cursor-pointer border-transparent text-ink`}
            onClick={toggleTheme}
            type="button"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </nav>

        <div className="col-span-3 flex justify-end self-center md:hidden">
          <button
            aria-controls={MENU_ID}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 flex h-11 w-11 cursor-pointer items-center justify-center text-ink transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
            onClick={() => setOpen((value) => !value)}
            ref={buttonRef}
            type="button"
          >
            <span aria-hidden="true" className="relative block h-3 w-4">
              <span
                className={`absolute inset-x-0 top-0 h-px bg-current transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${open ? "translate-y-1.5 rotate-45" : ""}`}
              />
              <span
                className={`absolute inset-x-0 top-1.5 h-px bg-current transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute inset-x-0 bottom-0 h-px bg-current transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        className="site-menu"
        data-open={open}
        id={MENU_ID}
        inert={!open}
        ref={panelRef}
      >
        <nav
          aria-label="Primary"
          className="mx-auto w-full max-w-[80rem] px-6 pb-2 pt-1 md:px-10"
        >
          <ul>
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  activeProps={{
                    "aria-current": "page",
                    className: "text-ember-text",
                  }}
                  className="flex min-h-11 items-center border-b border-[var(--hairline)] font-mono text-[0.75rem] uppercase tracking-[0.14em] text-ink transition-colors duration-200 hover:text-ember-text"
                  inactiveProps={{ className: "text-ink" }}
                  onClick={() => setOpen(false)}
                  to={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                aria-pressed={dark}
                className="flex min-h-11 w-full cursor-pointer items-center border-transparent font-mono text-[0.75rem] uppercase tracking-[0.14em] text-ink transition-colors duration-200 hover:text-ember-text"
                onClick={toggleTheme}
                type="button"
              >
                {dark ? "Light" : "Dark"}
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <noscript dangerouslySetInnerHTML={{ __html: fallbackNav }} />

      {/* One masked backdrop-blur layer instead of Cult UI's stack: the blur
          fades out below the header so scrolled content never ends in a hard
          line. Decorative, never clickable, gone under reduced motion. */}
      <div aria-hidden="true" className="header-blur" />
    </header>
  );
}
