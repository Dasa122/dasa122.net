import type { siteSettingsSchema } from "@dasa122/contract";
import { Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalOrigin } from "../utils/canonical";
import { orpc } from "../utils/orpc";

type Settings = ReturnType<typeof siteSettingsSchema.parse>;
type ElsewhereLink = { href: string; label: string };

const TITLE = "About — Dasa122";
const DESCRIPTION =
  "About Dasa122 — the current focus, elsewhere on the web, and how to get in touch.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const label =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";

const sourceLabels = {
  github: "Building in public on GitHub",
  linkedin: "Publishing on LinkedIn",
  own: "Writing notes here",
} as const;

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
 * copy from the admin panel. The 12-column layout leaves the left column
 * empty on purpose: the asymmetry is the design.
 */
export function AboutPage() {
  const site = useQuery(siteOptions);

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          {site.isPending && (
            <p className="font-mono text-[0.75rem] text-muted">Loading…</p>
          )}
          {site.isError && (
            <p className="font-mono text-[0.75rem] text-ember-text">
              Could not load the about page.
            </p>
          )}
          {site.data && <AboutContent settings={site.data} />}
        </Section>
      </div>
    </main>
  );
}

function AboutContent({ settings }: { settings: Settings }) {
  const elsewhere: ElsewhereLink[] = [
    settings.socials.github
      ? { href: settings.socials.github, label: "GitHub" }
      : settings.githubUsername
        ? {
            href: `https://github.com/${settings.githubUsername}`,
            label: "GitHub",
          }
        : null,
    settings.socials.linkedin
      ? { href: settings.socials.linkedin, label: "LinkedIn" }
      : null,
    settings.socials.rss ? { href: settings.socials.rss, label: "RSS" } : null,
  ].filter((link): link is ElsewhereLink => link !== null);

  return (
    <>
      <header className="grid grid-cols-12 gap-x-6 gap-y-6">
        <div className="hidden md:col-span-4 md:block" />
        <div className="col-span-12 md:col-span-7 md:col-start-6">
          <p className={label}>{settings.name}</p>
          <h1 className="mt-4 font-display text-[clamp(3rem,9vw,6rem)] leading-[0.95] tracking-[-0.03em]">
            About
          </h1>
          {settings.tagline && (
            <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink md:text-xl">
              {settings.tagline}
            </p>
          )}
        </div>
      </header>

      {settings.description && (
        <>
          <div className="mt-12">
            <Rule />
          </div>
          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-4">
            <p className={`${label} col-span-12 md:col-span-3`}>Biography</p>
            <p className="col-span-12 max-w-[68ch] text-[1.0625rem] leading-[1.75] text-ink md:col-span-7">
              {settings.description}
            </p>
          </div>
        </>
      )}

      <div className="mt-12">
        <Rule />
      </div>

      <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-10">
        <div className="hidden md:col-span-4 md:block" />
        <div className="col-span-12 space-y-10 md:col-span-7 md:col-start-6">
          <section>
            <h2 className={label}>CURRENTLY</h2>
            <ul className="mt-4 space-y-2 text-ink">
              {settings.enabledSources.map((source) => (
                <li key={source}>{sourceLabels[source]}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className={label}>ELSEWHERE</h2>
            {elsewhere.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {elsewhere.map((link) => (
                  <li key={link.href}>
                    <a
                      className="underline decoration-rule underline-offset-4 transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:decoration-ember-text"
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
            <h2 className={label}>CONTACT</h2>
            {settings.socials.email ? (
              <p className="mt-4">
                <a
                  className="underline decoration-rule underline-offset-4 transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:decoration-ember-text"
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
    </>
  );
}
