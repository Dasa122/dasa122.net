import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AdminHeading } from "../../components/admin-heading";
import {
  SettingsForm,
  type SettingsFormValues,
} from "../../components/settings-form";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
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
        palette: data.palette,
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
      palette: values.palette,
      socials: values.socials,
      tagline: values.tagline,
    });
  };

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading title="Settings" />

          {settings.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading the settings…
            </p>
          )}
          {settings.isError && (
            <p className={`mt-10 ${errorText}`}>Could not load the settings.</p>
          )}

          {initial && (
            <>
              <div className="glass-card mt-8 max-w-[52rem] p-6 sm:p-8">
                <SettingsForm
                  initial={initial}
                  isPending={update.isPending}
                  onSave={save}
                />
              </div>
              <div className="mt-5">
                {update.isError && (
                  <p className={errorText}>{update.error.message}</p>
                )}
                {update.isSuccess && <p className={muted}>Saved.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
