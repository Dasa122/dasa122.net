import { Button } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminHeading } from "../../components/admin-heading";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const label =
  "block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

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
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading title="LinkedIn" />

          {status.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading the LinkedIn status…
            </p>
          )}
          {status.isError && (
            <p className={`mt-10 ${errorText}`}>
              Could not load the LinkedIn status.
            </p>
          )}

          {status.data && (
            <>
              <section className="glass-card mt-8 p-6 sm:p-7">
                <p className={label}>Tier</p>
                <p className="mt-2 font-display text-2xl tracking-[-0.03em] text-ink">
                  {status.data.tier}
                </p>
                {status.data.message !== null && (
                  <p className="mt-3 max-w-[70ch] text-base leading-relaxed text-muted">
                    {status.data.message}
                  </p>
                )}
              </section>

              <section className="glass-card mt-4 p-6 sm:p-7">
                <p className={label}>Publish a LinkedIn post</p>

                <form
                  className="mt-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    publish.mutate({ body, permalink });
                  }}
                >
                  <div className="space-y-6">
                    <div>
                      <label className={label} htmlFor="linkedin-body">
                        Body
                      </label>
                      <textarea
                        className="admin-field min-h-48 resize-y"
                        id="linkedin-body"
                        onChange={(event) => setBody(event.target.value)}
                        required
                        value={body}
                      />
                    </div>

                    <div>
                      <label className={label} htmlFor="linkedin-permalink">
                        Permalink
                      </label>
                      <input
                        className="admin-field"
                        id="linkedin-permalink"
                        onChange={(event) => setPermalink(event.target.value)}
                        required
                        type="url"
                        value={permalink}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
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
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
