import type { projectSchema } from "@dasa122/contract";
import { Button } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminHeading } from "../../components/admin-heading";
import {
  ProjectEditor,
  type ProjectEditorInitial,
  type ProjectEditorValues,
} from "../../components/project-editor";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

const listOptions = orpc.adminProjects.list.queryOptions({ input: {} });

type Project = ReturnType<typeof projectSchema.parse>;

const emptyProject: ProjectEditorInitial = {
  body: null,
  coverImage: null,
  featured: false,
  id: null,
  liveUrl: null,
  repoUrl: null,
  sortOrder: 0,
  stack: [],
  summary: "",
  title: "",
};

function toInitial(project: Project): ProjectEditorInitial {
  return {
    body: project.body,
    coverImage: project.coverImage,
    featured: project.featured,
    id: project.id,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    sortOrder: project.sortOrder,
    stack: project.stack,
    summary: project.summary,
    title: project.title,
  };
}

export const Route = createFileRoute("/admin/work")({
  component: AdminWork,
  head: () => ({ meta: [{ title: "Work — Admin" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(listOptions),
});

function AdminWork() {
  const list = useQuery(listOptions);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.adminProjects.list.key(),
    });
  };

  const create = useMutation(
    orpc.adminProjects.create.mutationOptions({
      onSuccess: () => {
        setCreating(false);
        refresh();
      },
    }),
  );
  const update = useMutation(
    orpc.adminProjects.update.mutationOptions({ onSuccess: refresh }),
  );
  const remove = useMutation(
    orpc.adminProjects.delete.mutationOptions({ onSuccess: refresh }),
  );

  const projects = list.data?.items ?? [];
  const isPending = create.isPending || update.isPending || remove.isPending;

  const saveNew = (values: ProjectEditorValues) => create.mutate(values);
  const saveExisting =
    (id: string) =>
    (values: ProjectEditorValues): void =>
      update.mutate({ id, ...values });

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading
            action={
              !creating ? (
                <Button onClick={() => setCreating(true)} variant="solid">
                  New project
                </Button>
              ) : undefined
            }
            title="Work"
          />

          {list.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading projects…
            </p>
          )}
          {list.isError && (
            <p className={`mt-10 ${errorText}`}>Could not load projects.</p>
          )}
          {list.isSuccess && projects.length === 0 && !creating && (
            <p className={`mt-10 ${muted}`}>No projects yet.</p>
          )}

          <div className="mt-8 space-y-4">
            {creating && (
              <div className="glass-card max-w-[62rem] p-5 sm:p-7">
                <ProjectEditor
                  initial={emptyProject}
                  isPending={isPending}
                  onDelete={() => setCreating(false)}
                  onSave={saveNew}
                />
              </div>
            )}

            {projects.map((project) => (
              <div
                className="glass-card max-w-[62rem] p-5 sm:p-7"
                key={project.id}
              >
                <ProjectEditor
                  initial={toInitial(project)}
                  isPending={isPending}
                  onDelete={() => remove.mutate({ id: project.id })}
                  onSave={saveExisting(project.id)}
                />
              </div>
            ))}
          </div>

          {(create.isError || update.isError || remove.isError) && (
            <p className={`mt-6 ${errorText}`}>Could not save the project.</p>
          )}
        </div>
      </div>
    </main>
  );
}
