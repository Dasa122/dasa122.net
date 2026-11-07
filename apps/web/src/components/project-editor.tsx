import { Button } from "@dasa122/ui";
import { useState } from "react";

/** The values the editor hands back to its consumer on save. */
export type ProjectEditorValues = {
  body: string | null;
  coverImage: string | null;
  featured: boolean;
  liveUrl: string | null;
  repoUrl: string | null;
  sortOrder: number;
  stack: string[];
  summary: string;
  title: string;
};

/** The project an editor starts from. `id` is null for a new project. */
export type ProjectEditorInitial = ProjectEditorValues & { id: string | null };

const label =
  "block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const hint = "normal-case tracking-normal";
const note = "mt-2 font-mono text-[0.6875rem] leading-relaxed text-muted";
const field =
  "mt-2 w-full border-b border-rule bg-transparent py-2 text-base leading-relaxed text-ink outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] focus:border-ink";

/** A trimmed value, or null when the field is blank. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function commaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The project editor. It is a controlled form with no background saving: the
 * project is only written when save is pressed, and both actions are disabled
 * while the consumer's mutation is in flight.
 *
 * `featured` is a checkbox here and the only checkbox in the admin UI;
 * everything else that toggles is a button.
 *
 * The body is accepted and stored, but no public route renders it yet — the
 * API returns no rendered HTML for projects (ledger R45) — so the field carries
 * that fact next to it rather than letting an author assume it appears.
 */
export function ProjectEditor({
  initial,
  onSave,
  onDelete,
  isPending,
}: {
  initial: ProjectEditorInitial;
  onSave: (values: ProjectEditorValues) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body ?? "");
  const [stack, setStack] = useState(initial.stack.join(", "));
  const [repoUrl, setRepoUrl] = useState(initial.repoUrl ?? "");
  const [liveUrl, setLiveUrl] = useState(initial.liveUrl ?? "");
  const [coverImage, setCoverImage] = useState(initial.coverImage ?? "");
  const [featured, setFeatured] = useState(initial.featured);
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));

  const prefix = initial.id ?? "new";

  const values = (): ProjectEditorValues => ({
    body: optional(body),
    coverImage: optional(coverImage),
    featured,
    liveUrl: optional(liveUrl),
    repoUrl: optional(repoUrl),
    sortOrder: toInteger(sortOrder),
    stack: commaSeparated(stack),
    summary: summary.trim(),
    title: title.trim(),
  });

  return (
    <form
      className="py-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values());
      }}
    >
      <div className="space-y-8">
        <div>
          <label className={label} htmlFor={`project-${prefix}-title`}>
            Title
          </label>
          <input
            className={field}
            id={`project-${prefix}-title`}
            onChange={(event) => setTitle(event.target.value)}
            required
            type="text"
            value={title}
          />
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-summary`}>
            Summary
          </label>
          <textarea
            className={field}
            id={`project-${prefix}-summary`}
            onChange={(event) => setSummary(event.target.value)}
            required
            rows={2}
            value={summary}
          />
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-body`}>
            Body <span className={hint}>(markdown)</span>
          </label>
          <textarea
            className={`${field} min-h-48 resize-y font-mono text-[0.875rem]`}
            id={`project-${prefix}-body`}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
          <p className={note}>
            Accepted and stored, but not displayed anywhere public yet.
          </p>
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-stack`}>
            Stack <span className={hint}>(comma-separated)</span>
          </label>
          <input
            className={field}
            id={`project-${prefix}-stack`}
            onChange={(event) => setStack(event.target.value)}
            type="text"
            value={stack}
          />
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-repo`}>
            Repository URL <span className={hint}>(optional)</span>
          </label>
          <input
            className={field}
            id={`project-${prefix}-repo`}
            onChange={(event) => setRepoUrl(event.target.value)}
            type="text"
            value={repoUrl}
          />
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-live`}>
            Live URL <span className={hint}>(optional)</span>
          </label>
          <input
            className={field}
            id={`project-${prefix}-live`}
            onChange={(event) => setLiveUrl(event.target.value)}
            type="text"
            value={liveUrl}
          />
        </div>

        <div>
          <label className={label} htmlFor={`project-${prefix}-cover`}>
            Cover image URL <span className={hint}>(optional)</span>
          </label>
          <input
            className={field}
            id={`project-${prefix}-cover`}
            onChange={(event) => setCoverImage(event.target.value)}
            type="text"
            value={coverImage}
          />
        </div>

        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-6">
          <div className="flex items-center gap-3">
            <input
              checked={featured}
              className="h-4 w-4"
              id={`project-${prefix}-featured`}
              onChange={(event) => setFeatured(event.target.checked)}
              type="checkbox"
            />
            <label
              className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted"
              htmlFor={`project-${prefix}-featured`}
            >
              Featured
            </label>
          </div>

          <div className="w-24">
            <label className={label} htmlFor={`project-${prefix}-sort`}>
              Sort order
            </label>
            <input
              className={field}
              id={`project-${prefix}-sort`}
              onChange={(event) => setSortOrder(event.target.value)}
              type="number"
              value={sortOrder}
            />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <Button
          disabled={isPending}
          onClick={() => onSave(values())}
          variant="solid"
        >
          Save project
        </Button>
        <Button disabled={isPending} onClick={onDelete} variant="quiet">
          {initial.id === null ? "Discard" : "Delete"}
        </Button>
      </div>
    </form>
  );
}
