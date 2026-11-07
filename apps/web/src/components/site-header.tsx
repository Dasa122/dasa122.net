import { Link } from "@tanstack/react-router";
import { navigation } from "../lib/navigation";

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-[2px]">
      <div className="mx-auto grid w-full max-w-[80rem] grid-cols-12 items-baseline gap-x-6 px-6 py-5 md:px-10">
        <Link
          className="col-span-6 font-display text-2xl leading-none tracking-[-0.01em] md:col-span-3"
          to="/"
        >
          {name}
        </Link>
        <nav
          aria-label="Primary"
          className="col-span-6 flex flex-wrap justify-end gap-x-3 gap-y-1 md:col-span-4 md:col-start-9 md:gap-8"
        >
          {navigation.map((item) => (
            <Link
              activeProps={{
                "aria-current": "page",
                className: "border-ember text-ember-text",
              }}
              className="border-b pb-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-ember hover:text-ember-text"
              inactiveProps={{ className: "border-transparent text-ink" }}
              key={item.href}
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
