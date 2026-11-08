import type { ReactNode } from "react";

// Every action is a pill. The press is a scale, the hover is a slightly larger
// scale on the spring curve, and nothing moves layout.
const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-[transform,background-color,box-shadow,color,border-color] duration-300 ease-[var(--ease-out)] hover:ease-[var(--ease-spring)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

// The solid fill is one colour, `--acc-fill`, and `on-accent` is near-white:
// every preset measured at least 4.9:1 for that pair. No glow, no gradient.
const variants = {
  quiet: `${base} border border-[var(--glass-edge)] bg-[var(--glass-bg)] px-5 py-3 text-ink shadow-[inset_0_1px_0_var(--glass-hi)] backdrop-blur-md hover:scale-[1.02] hover:bg-[var(--glass-bg-hover)]`,
  solid: `${base} bg-ember-fill px-5 py-3 text-on-accent hover:scale-[1.02]`,
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
