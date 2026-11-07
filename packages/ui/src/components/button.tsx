import type { ReactNode } from "react";

const base =
  "inline-flex items-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:underline hover:underline-offset-4";

// The solid fill uses `ember-fill`, a dedicated non-text token that is the
// same value in both palettes: paper text measures 5.9:1 on it in light and
// dark. `ember` is 4.2:1 (fails AA), and `ember-text` is remapped light in
// dark mode, where paper on it is only 2.2:1.
const variants = {
  quiet: `${base} text-ink hover:text-ember-text`,
  solid: `${base} bg-ember-fill px-5 py-3 text-paper`,
} as const;

export function Button({
  variant,
  href,
  children,
}: {
  variant: "solid" | "quiet";
  href?: string;
  children: ReactNode;
}) {
  const className = variants[variant];

  if (href) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button className={className} type="button">
      {children}
    </button>
  );
}
