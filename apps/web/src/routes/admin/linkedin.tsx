import { Button, Rule, Section } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";
const field =
  "mt-2 w-full border-b border-rule bg-transparent py-2 text-base leading-relaxed text-ink outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] focus:border-ink";

const statusOptions = orpc.adminLinkedin.status.queryOptions({ input: {} });

export const Route = createFileRoute("/admin/linkedin")({
  component: AdminLinkedin,
  head: () => ({ meta: [{ title: "LinkedIn — Admin" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(statusOptions),
});

function AdminLinkedin() {
  const status = useQuery(statusOptions);
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [permalink, setPermalink] = useState("");

  const publish = useMutation(
    orpc.adminLinkedin.publish.mutationOptions({
      onSuccess: () => {
        setBody("");
        setPermalink("");
        void queryClient.invalidateQueries({
          queryKey: orpc.posts.list.key(),
        });
      },
    }),
  );

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <header>
            <p className={eyebrow}>Admin</p>
            <h1 className={`mt-2 ${heading}`}>LinkedIn</h1>
          </header>

          <div className="mt-10">
            {status.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading the LinkedIn status…
              </p>
            )}
            {status.isError && (
              <p className={`py-5 ${errorText}`}>
                Could not load the LinkedIn status.
              </p>
            )}
          </div>

          {status.data && (
            <>
              <div className="mt-2">
                <p className={eyebrow}>TIER</p>
                <p className="mt-2 font-mono text-lg text-ink">
                  {status.data.tier}
                </p>
                {status.data.message !== null && (
                  <p className="mt-3 max-w-[70ch] text-base leading-relaxed text-ink">
                    {status.data.message}
                  </p>
                )}
              </div>

              <div className="mt-14">
                <p className={eyebrow}>PUBLISH A LINKEDIN POST</p>
                <Rule className="mt-4" />

                <form
                  className="mt-8"
                  onSubmit={(event) => {
                    event.preventDefault();
                    publish.mutate({ body, permalink });
                  }}
                >
                  <div className="space-y-8">
                    <div>
                      <label className={eyebrow} htmlFor="linkedin-body">
                        Body
                      </label>
                      <textarea
                        className={`${field} min-h-48 resize-y`}
                        id="linkedin-body"
                        onChange={(event) => setBody(event.target.value)}
                        required
                        value={body}
                      />
                    </div>

                    <div>
                      <label className={eyebrow} htmlFor="linkedin-permalink">
                        Permalink
                      </label>
                      <input
                        className={field}
                        id="linkedin-permalink"
                        onChange={(event) => setPermalink(event.target.value)}
                        required
                        type="url"
                        value={permalink}
                      />
                    </div>
                  </div>

                  <div className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-3">
                    <Button
                      disabled={publish.isPending}
                      onClick={() => publish.mutate({ body, permalink })}
                      variant="solid"
                    >
                      Publish
                    </Button>
                    {publish.isPending && (
                      <span className={muted}>Publishing…</span>
                    )}
                    {publish.isSuccess && (
                      <span className={muted}>Published into the feed.</span>
                    )}
                  </div>

                  {publish.isError && (
                    <p className={`mt-4 ${errorText}`}>
                      {publish.error.message}
                    </p>
                  )}
                </form>
              </div>
            </>
          )}
        </Section>
      </div>
    </main>
  );
}
