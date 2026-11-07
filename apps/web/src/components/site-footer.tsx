import { navigation } from "../lib/navigation";

export function SiteFooter({ name }: { name: string }) {
  return (
    <footer className="border-t border-[var(--hairline)]">
      <div className="mx-auto grid w-full max-w-[80rem] grid-cols-12 items-baseline gap-x-6 gap-y-3 px-6 py-10 md:px-10">
        <p className="col-span-12 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted tabular-nums md:col-span-3">
          © 2026 {name}
        </p>
        <nav
          aria-label="Footer"
          className="col-span-12 flex flex-wrap gap-5 md:col-span-4 md:col-start-9 md:justify-end"
        >
          {navigation.map((item) => (
            <a
              className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
