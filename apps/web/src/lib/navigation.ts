export type NavHref = "/about" | "/github" | "/news" | "/work";

export type NavItem = {
  readonly href: NavHref;
  readonly label: string;
};

export const navigation: readonly NavItem[] = [
  { href: "/news", label: "News" },
  { href: "/work", label: "Work" },
  { href: "/github", label: "GitHub" },
  { href: "/about", label: "About" },
];
