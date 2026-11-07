import type { projectSchema } from "@dasa122/contract";
import { Button, Rule, Section } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import {
  ProjectEditor,
  type ProjectEditorInitial,
  type ProjectEditorValues,
} from "../../components/project-editor";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
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
        <Section>
          <header className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className={eyebrow}>Admin</p>
              <h1 className={`mt-2 ${heading}`}>Work</h1>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)} variant="solid">
                New project
              </Button>
            )}
          </header>

          <div className="mt-10">
            <Rule />
            {list.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading projects…
              </p>
            )}
            {list.isError && (
              <p className={`py-5 ${errorText}`}>Could not load projects.</p>
            )}
            {list.isSuccess && projects.length === 0 && !creating && (
              <p className={`py-5 ${muted}`}>No projects yet.</p>
            )}

            {creating && (
              <>
                <ProjectEditor
                  initial={emptyProject}
                  isPending={isPending}
                  onDelete={() => setCreating(false)}
                  onSave={saveNew}
                />
                {projects.length > 0 && <Rule />}
              </>
            )}

            {projects.map((project, index) => (
              <Fragment key={project.id}>
                {index > 0 && <Rule />}
                <ProjectEditor
                  initial={toInitial(project)}
                  isPending={isPending}
                  onDelete={() => remove.mutate({ id: project.id })}
                  onSave={saveExisting(project.id)}
                />
              </Fragment>
            ))}
          </div>

          {(create.isError || update.isError || remove.isError) && (
            <p className={`py-5 ${errorText}`}>Could not save the project.</p>
          )}
        </Section>
      </div>
    </main>
  );
}
