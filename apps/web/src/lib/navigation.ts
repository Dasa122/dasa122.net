export type NavItem = {
  readonly href: string;
  readonly label: string;
};

export const navigation: readonly NavItem[] = [
  { href: "/news", label: "News" },
  { href: "/work", label: "Work" },
  { href: "/github", label: "GitHub" },
  { href: "/about", label: "About" },
];
