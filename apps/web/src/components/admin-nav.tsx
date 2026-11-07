import { Fragment } from "react";

const link =
  "font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text";

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
 * header: quiet text links separated by a middle dot, plus sign out.
 */
export function AdminNav() {
  return (
    <nav
      aria-label="Admin"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-2 py-4"
    >
      {links.map((item, index) => (
        <Fragment key={item.href}>
          {index > 0 && (
            <span aria-hidden="true" className="text-rule">
              ·
            </span>
          )}
          <a className={link} href={item.href}>
            {item.label}
          </a>
        </Fragment>
      ))}
      <span aria-hidden="true" className="text-rule">
        ·
      </span>
      <form action="/api/auth/logout" method="post">
        <button className={`${link} cursor-pointer`} type="submit">
          Sign out
        </button>
      </form>
    </nav>
  );
}
