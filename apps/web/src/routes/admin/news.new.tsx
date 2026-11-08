import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { AdminHeading } from "../../components/admin-heading";
import {
  PostEditor,
  type PostEditorInitial,
  type PostEditorValues,
} from "../../components/post-editor";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
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
  const update = useMutation(orpc.adminPosts.update.mutationOptions());
  const publish = useMutation(orpc.adminPosts.publish.mutationOptions());
  // A create that succeeded before a publish failure must not be repeated:
  // retrying publish (or saving) works on the draft it already made.
  const createdId = useRef<string | null>(null);

  const finish = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.adminPosts.list.key(),
    });
    void navigate({ to: "/admin/news" });
  };

  const save = (values: PostEditorValues) => {
    const id = createdId.current;
    if (id) {
      update.mutate({ id, ...values }, { onSuccess: finish });
      return;
    }
    create.mutate(values, {
      onSuccess: (post) => {
        createdId.current = post.id;
        finish();
      },
    });
  };

  const publishNow = (values: PostEditorValues) => {
    const id = createdId.current;
    if (id) {
      publish.mutate({ id }, { onSuccess: finish });
      return;
    }
    create.mutate(values, {
      onSuccess: (post) => {
        createdId.current = post.id;
        publish.mutate({ id: post.id }, { onSuccess: finish });
      },
    });
  };

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading title="New post" />

          <div className="glass-card mt-8 max-w-[62rem] p-6 sm:p-8">
            {(create.isError || update.isError || publish.isError) && (
              <p className={`mb-6 ${errorText}`}>
                {publish.isError
                  ? "Saved as a draft, but publishing failed."
                  : "Could not save the post."}
              </p>
            )}

            <PostEditor
              initial={emptyPost}
              isPending={
                create.isPending || update.isPending || publish.isPending
              }
              onPublish={publishNow}
              onSave={save}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
