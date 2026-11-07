import type { ReactNode } from "react";

const base =
  "inline-flex items-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-[color,background-color,background-size,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:translate-y-px active:scale-[0.99]";

// The solid fill uses `ember-fill`, a dedicated non-text token that is the
// same value in both palettes: `on-accent` measures 5.87:1 on it in light and
// dark. `ember` is 4.2:1 (fails AA), and `ember-text` is remapped light in
// dark mode, where paper on it is only 2.2:1.
const variants = {
  quiet: `${base} bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat text-ink hover:bg-[length:100%_1px] hover:text-ember-text`,
  solid: `${base} rounded-[var(--radius-sm)] bg-ember-fill px-5 py-3 text-on-accent hover:bg-[color-mix(in_oklab,var(--color-ember-fill)_88%,black)] hover:shadow-[var(--shadow-lift)]`,
} as const;

/**
 * The Button styling for a variant, exported so router-aware links can share
 * the primitive's look without re-styling it inline.
 */
export function buttonClassName(variant: "solid" | "quiet"): string {
  return variants[variant];
}

export function Button({
  variant,
  href,
  onClick,
  disabled,
  children,
}: {
  variant: "solid" | "quiet";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = buttonClassName(variant);

  if (href) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button
      className={`${className} disabled:opacity-50`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
