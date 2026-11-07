import { Section } from "@dasa122/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  PostEditor,
  type PostEditorInitial,
  type PostEditorValues,
} from "../../components/post-editor";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

const emptyPost: PostEditorInitial = {
  body: "",
  coverImage: "",
  excerpt: "",
  id: null,
  source: "own",
  status: "draft",
  tags: [],
  title: "",
};

export const Route = createFileRoute("/admin/news/new")({
  component: NewPostPage,
  head: () => ({ meta: [{ title: "New post — Admin" }] }),
});

function NewPostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useMutation(orpc.adminPosts.create.mutationOptions());
  const publish = useMutation(orpc.adminPosts.publish.mutationOptions());

  const finish = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.adminPosts.list.key(),
    });
    void navigate({ to: "/admin/news" });
  };

  const save = (values: PostEditorValues) =>
    create.mutate(values, { onSuccess: finish });

  const publishNow = (values: PostEditorValues) =>
    create.mutate(values, {
      onSuccess: (post) =>
        publish.mutate({ id: post.id }, { onSuccess: finish }),
    });

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <header>
            <p className={eyebrow}>Admin</p>
            <h1 className={`mt-2 ${heading}`}>New post</h1>
          </header>

          {(create.isError || publish.isError) && (
            <p className={`mt-8 ${errorText}`}>Could not save the post.</p>
          )}

          <PostEditor
            initial={emptyPost}
            isPending={create.isPending || publish.isPending}
            onPublish={publishNow}
            onSave={save}
          />
        </Section>
      </div>
    </main>
  );
}
