import { Rule, Section } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  SettingsForm,
  type SettingsFormValues,
} from "../../components/settings-form";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

const settingsOptions = orpc.adminSettings.get.queryOptions({ input: {} });

/** A blank optional field is stored as null, not an empty string. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(settingsOptions),
});

function AdminSettings() {
  const settings = useQuery(settingsOptions);
  const queryClient = useQueryClient();

  const update = useMutation(
    orpc.adminSettings.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.adminSettings.get.key(),
        });
        void queryClient.invalidateQueries({ queryKey: orpc.site.get.key() });
      },
    }),
  );

  const data = settings.data;

  const initial: SettingsFormValues | null = data
    ? {
        accent: data.accent ?? "",
        description: data.description,
        enabledSources: data.enabledSources,
        githubUsername: data.githubUsername ?? "",
        name: data.name,
        ogImage: data.ogImage ?? "",
        socials: data.socials,
        tagline: data.tagline,
      }
    : null;

  const save = (values: SettingsFormValues) => {
    update.mutate({
      accent: blankToNull(values.accent),
      description: values.description,
      enabledSources: values.enabledSources,
      githubUsername: blankToNull(values.githubUsername),
      name: values.name,
      ogImage: blankToNull(values.ogImage),
      socials: values.socials,
      tagline: values.tagline,
    });
  };

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <header>
            <p className={eyebrow}>Admin</p>
            <h1 className={`mt-2 ${heading}`}>Settings</h1>
          </header>

          <div className="mt-10">
            <Rule />
            {settings.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading the settings…
              </p>
            )}
            {settings.isError && (
              <p className={`py-5 ${errorText}`}>
                Could not load the settings.
              </p>
            )}
          </div>

          {initial && (
            <>
              <SettingsForm
                initial={initial}
                isPending={update.isPending}
                onSave={save}
              />
              <div className="mt-6">
                {update.isError && (
                  <p className={errorText}>{update.error.message}</p>
                )}
                {update.isSuccess && <p className={muted}>Saved.</p>}
              </div>
            </>
          )}
        </Section>
      </div>
    </main>
  );
}
