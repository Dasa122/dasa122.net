import type { siteSettingsSchema } from "@dasa122/contract";
import { buttonClassName } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "../components/section-heading";
import { canonicalOrigin } from "../utils/canonical";
import { orpc } from "../utils/orpc";

type Settings = ReturnType<typeof siteSettingsSchema.parse>;
type ElsewhereLink = { href: string; label: string };

const TITLE = "About — Dasa122";
const DESCRIPTION =
  "About Dasa122 — the current focus, elsewhere on the web, and how to get in touch.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const page = `${frame} pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(4rem,10vw,9rem)]`;

const sourceLabels = {
  github: "Building in public on GitHub",
  linkedin: "Publishing on LinkedIn",
  own: "Writing notes here",
} as const;

/** The short, factual kicker under each timeline entry. */
const sourceKickers = {
  github: "GITHUB",
  linkedin: "LINKEDIN",
  own: "NOTES",
} as const;

/** One gradient per timeline dot, cycled through the same family as the site. */
const DOT_FILLS = [
  "var(--grad-1)",
  "var(--grad-2)",
  "var(--grad-3)",
  "var(--grad-4)",
] as const;

// One options object shared by the loader's prefetch and the component's
// `useQuery` so the server render is never fetched twice.
const siteOptions = orpc.site.get.queryOptions({ input: {} });

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => {
    const canonical = `${canonicalOrigin()}/about`;
    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title: TITLE },
        { content: DESCRIPTION, name: "description" },
        { content: TITLE, property: "og:title" },
        { content: DESCRIPTION, property: "og:description" },
        { content: canonical, property: "og:url" },
        { content: "website", property: "og:type" },
      ],
    };
  },
  loader: ({ context }) => context.queryClient.prefetchQuery(siteOptions),
});

/**
 * The about page reads everything from `site.get`, so the owner can edit the
 * copy from the admin panel. The page is one statement in the site's own
 * voice, then the biography, then the three facts the settings actually hold.
 */
export function AboutPage() {
  const site = useQuery(siteOptions);

  return (
    <main className="flex-1">
      <div className={page}>
        {site.isPending && (
          <p className="font-mono text-[0.75rem] text-muted">Loading…</p>
        )}
        {site.isError && (
          <p className="font-mono text-[0.75rem] text-ember-text">
            Could not load the about page.
          </p>
        )}
        {site.data && <AboutContent settings={site.data} />}
      </div>
    </main>
  );
}

/**
 * The statement's last word carries the gradient. Splitting on the last space
 * keeps the copy exactly as it is stored — nothing is rewritten to fit the
 * treatment, and a one-word statement simply renders plain.
 */
function Statement({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  const last = words.pop() ?? "";

  return (
    <>
      {words.length > 0 && `${words.join(" ")} `}
      <span className="gradient-word">{last}</span>
    </>
  );
}

/**
 * Social links are free-text settings, so a scheme-less value would otherwise
 * resolve as a relative path. Accept only http(s), drop any other scheme, and
 * treat everything else as a bare host.
 */
function toHref(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function toLink(value: string | undefined, label: string): ElsewhereLink[] {
  const href = toHref(value);
  return href ? [{ href, label }] : [];
}

function AboutContent({ settings }: { settings: Settings }) {
  const githubLinks: ElsewhereLink[] = settings.socials.github
    ? toLink(settings.socials.github, "GitHub")
    : settings.githubUsername
      ? [
          {
            href: `https://github.com/${encodeURIComponent(settings.githubUsername)}`,
            label: "GitHub",
          },
        ]
      : [];
  const elsewhere: ElsewhereLink[] = [
    ...githubLinks,
    ...toLink(settings.socials.linkedin, "LinkedIn"),
    ...toLink(settings.socials.rss, "RSS"),
  ];

  const statement = settings.tagline.trim() || `About ${settings.name}`;

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-12">
      <header className="col-span-12 pt-[clamp(0.5rem,2vw,1.5rem)] md:col-span-5">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
          {settings.name} · About
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
          <Statement text={statement} />
        </h1>
      </header>

      <div className="col-span-12 space-y-12 md:col-span-7 md:col-start-6">
        {settings.description && (
          <section>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
              Biography
            </p>
            <p className="mt-4 max-w-[68ch] text-[1.0625rem] leading-[1.75] text-ink">
              {settings.description}
            </p>
          </section>
        )}

        <section>
          <SectionHeading label="01" title="Currently" />
          {settings.enabledSources.length > 0 ? (
            <ol className="timeline mt-6 space-y-7">
              {settings.enabledSources.map((source, index) => (
                <li className="timeline-item" key={source}>
                  <span
                    aria-hidden="true"
                    className="timeline-dot"
                    style={{
                      background: DOT_FILLS[index % DOT_FILLS.length],
                    }}
                  />
                  <p className="text-lg leading-snug text-ink">
                    {sourceLabels[source]}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted">
                    {sourceKickers[source]}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 font-mono text-[0.75rem] text-muted">
              Nothing published right now.
            </p>
          )}
        </section>

        <section>
          <SectionHeading label="02" title="Elsewhere" />
          {elsewhere.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {elsewhere.map((link) => (
                <li key={link.href}>
                  <a
                    className={buttonClassName("quiet")}
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 font-mono text-[0.75rem] text-muted">
              No links set yet.
            </p>
          )}
        </section>

        <section>
          <SectionHeading label="03" title="Contact" />
          {settings.socials.email ? (
            <p className="mt-5">
              <a
                className={buttonClassName("quiet")}
                href={`mailto:${settings.socials.email}`}
              >
                {settings.socials.email}
              </a>
            </p>
          ) : (
            <p className="mt-4 font-mono text-[0.75rem] text-muted">
              No contact address set yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
