import type { postSourceSchema } from "@dasa122/contract";
import { Button } from "@dasa122/ui";
import { useState } from "react";

type PostSource = ReturnType<typeof postSourceSchema.parse>;

/** The settings the form edits, with blank strings standing in for nulls. */
export type SettingsFormValues = {
  accent: string;
  description: string;
  enabledSources: PostSource[];
  githubUsername: string;
  name: string;
  ogImage: string;
  socials: {
    email?: string;
    github?: string;
    linkedin?: string;
    rss?: string;
  };
  tagline: string;
};

const SOURCES: { label: string; value: PostSource }[] = [
  { label: "Notes", value: "own" },
  { label: "GitHub", value: "github" },
  { label: "LinkedIn", value: "linkedin" },
];

const label =
  "block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const hint = "normal-case tracking-normal";
const field =
  "mt-2 w-full border-b border-rule bg-transparent py-2 text-base leading-relaxed text-ink outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] focus:border-ink";
const group =
  "mt-10 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";

/**
 * The site settings editor. It is a controlled form: nothing is written until
 * the save action is pressed, and the action is disabled while the consumer's
 * mutation is in flight.
 *
 * The accent is an `oklch(...)` string typed by hand; there is deliberately no
 * colour picker, because the value is a design token rather than a swatch.
 */
export function SettingsForm({
  initial,
  onSave,
  isPending,
}: {
  initial: SettingsFormValues;
  onSave: (values: SettingsFormValues) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [description, setDescription] = useState(initial.description);
  const [ogImage, setOgImage] = useState(initial.ogImage);
  const [accent, setAccent] = useState(initial.accent);
  const [enabledSources, setEnabledSources] = useState(initial.enabledSources);
  const [githubUsername, setGithubUsername] = useState(initial.githubUsername);
  const [github, setGithub] = useState(initial.socials.github ?? "");
  const [linkedin, setLinkedin] = useState(initial.socials.linkedin ?? "");
  const [email, setEmail] = useState(initial.socials.email ?? "");
  const [rss, setRss] = useState(initial.socials.rss ?? "");

  const values = (): SettingsFormValues => ({
    accent,
    description,
    enabledSources,
    githubUsername,
    name: name.trim(),
    ogImage,
    socials: { email, github, linkedin, rss },
    tagline,
  });

  return (
    <form
      className="mt-10"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values());
      }}
    >
      <div className="space-y-8">
        <div>
          <label className={label} htmlFor="settings-name">
            Site name
          </label>
          <input
            className={field}
            id="settings-name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </div>

        <div>
          <label className={label} htmlFor="settings-tagline">
            Tagline
          </label>
          <input
            className={field}
            id="settings-tagline"
            onChange={(event) => setTagline(event.target.value)}
            type="text"
            value={tagline}
          />
        </div>

        <div>
          <label className={label} htmlFor="settings-description">
            Description
          </label>
          <textarea
            className={field}
            id="settings-description"
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </div>

        <div>
          <label className={label} htmlFor="settings-og-image">
            OG image URL <span className={hint}>(optional)</span>
          </label>
          <input
            className={field}
            id="settings-og-image"
            onChange={(event) => setOgImage(event.target.value)}
            type="text"
            value={ogImage}
          />
        </div>

        <div>
          <label className={label} htmlFor="settings-accent">
            Accent <span className={hint}>(an oklch(...) string)</span>
          </label>
          <input
            className={field}
            id="settings-accent"
            onChange={(event) => setAccent(event.target.value)}
            placeholder="oklch(0.62 0.14 250)"
            type="text"
            value={accent}
          />
        </div>

        <div>
          <label className={label} htmlFor="settings-github-username">
            GitHub username
          </label>
          <input
            className={field}
            id="settings-github-username"
            onChange={(event) => setGithubUsername(event.target.value)}
            type="text"
            value={githubUsername}
          />
        </div>
      </div>

      <fieldset className="mt-12">
        <legend className={group}>Feed sources</legend>
        <p className="mt-2 font-mono text-[0.6875rem] text-muted">
          The feed shows these sources by default.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {SOURCES.map((option) => (
            <label
              className="flex items-baseline gap-2 text-base text-ink"
              key={option.value}
            >
              <input
                checked={enabledSources.includes(option.value)}
                onChange={(event) =>
                  setEnabledSources((current) =>
                    event.target.checked
                      ? [...current, option.value]
                      : current.filter((source) => source !== option.value),
                  )
                }
                type="checkbox"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-12">
        <legend className={group}>Social links</legend>
        <div className="mt-4 space-y-8">
          <div>
            <label className={label} htmlFor="settings-social-github">
              GitHub
            </label>
            <input
              className={field}
              id="settings-social-github"
              onChange={(event) => setGithub(event.target.value)}
              type="text"
              value={github}
            />
          </div>

          <div>
            <label className={label} htmlFor="settings-social-linkedin">
              LinkedIn
            </label>
            <input
              className={field}
              id="settings-social-linkedin"
              onChange={(event) => setLinkedin(event.target.value)}
              type="text"
              value={linkedin}
            />
          </div>

          <div>
            <label className={label} htmlFor="settings-social-email">
              Email
            </label>
            <input
              className={field}
              id="settings-social-email"
              onChange={(event) => setEmail(event.target.value)}
              type="text"
              value={email}
            />
          </div>

          <div>
            <label className={label} htmlFor="settings-social-rss">
              RSS
            </label>
            <input
              className={field}
              id="settings-social-rss"
              onChange={(event) => setRss(event.target.value)}
              type="text"
              value={rss}
            />
          </div>
        </div>
      </fieldset>

      <div className="mt-12">
        <Button
          disabled={isPending}
          onClick={() => onSave(values())}
          variant="solid"
        >
          Save settings
        </Button>
      </div>
    </form>
  );
}
