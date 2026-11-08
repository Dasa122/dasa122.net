const link =
  "inline-flex min-h-9 items-center rounded-[var(--radius-pill)] px-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-[var(--ease-out)] hover:bg-[var(--glass-bg-hover)] hover:text-ink";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/work", label: "Work" },
  { href: "/admin/github", label: "GitHub" },
  { href: "/admin/linkedin", label: "LinkedIn" },
  { href: "/admin/settings", label: "Settings" },
] as const;

/**
 * The admin section's own navigation. It is a secondary strip under the site
 * header: a row of quiet pills, plus sign out.
 */
export function AdminNav() {
  return (
    <nav
      aria-label="Admin"
      className="flex flex-wrap items-center gap-x-1 gap-y-1 py-4"
    >
      {links.map((item) => (
        <a className={link} href={item.href} key={item.href}>
          {item.label}
        </a>
      ))}
      <form action="/api/auth/logout" method="post">
        <button className={`${link} cursor-pointer`} type="submit">
          Sign out
        </button>
      </form>
    </nav>
  );
}
