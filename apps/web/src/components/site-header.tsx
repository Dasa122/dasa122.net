import { navigation } from "../lib/navigation";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--hairline)]">
      <div className="mx-auto grid w-full max-w-[80rem] grid-cols-12 items-baseline gap-x-6 px-6 py-5 md:px-10">
        <a
          className="col-span-7 font-display text-2xl leading-none tracking-[-0.01em] md:col-span-3"
          href="/"
        >
          Dasa122
        </a>
        <nav
          aria-label="Primary"
          className="col-span-5 flex flex-wrap justify-end gap-3 md:col-span-4 md:col-start-9 md:gap-8"
        >
          {navigation.map((item) => (
            <a
              className="border-b border-transparent pb-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-ember hover:text-ember-text"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
