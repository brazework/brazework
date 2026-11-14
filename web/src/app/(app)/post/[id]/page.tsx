import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, Skeleton } from "@/components/app/page-ui";
import { type Post } from "@/lib/forge";
import { projectsForPosts } from "@/lib/project-posts";
import { dbFeatures, postSelect } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { PostCard } from "../../feed/post-card";
import { CommentForm, CommentThread, type ThreadComment } from "./comments-client";

export const metadata: Metadata = { title: "Post" };


// One post with its comments: /post/<id>. Notifications link here.
export default function PostPage({ params }: PageProps<"/post/[id]">) {
  return (
    <div className="mx-auto max-w-2xl xl:max-w-3xl">
      <LiveRefresh tables={["posts", "comments"]} />
      <Link href="/feed" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Feed</Link>
      <Suspense fallback={<><Skeleton className="h-56" /><Skeleton className="mt-4 h-40" /></>}>
        <PostView params={params} />
      </Suspense>
    </div>
  );
}

async function PostView({ params }: { params: PageProps<"/post/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("posts")
    .select(await postSelect())
    .eq("id", id)
    .maybeSingle();
  if (!data)
    return <EmptyState title="This post isn't available" body="It was deleted, or it's in a community you can't see." action={<Link href="/feed" className="text-sm underline underline-offset-4">Go to your feed</Link>} />;
  const post = data as unknown as Post & { community_name: string | null };

  const threads = (await dbFeatures()).commentThreads;
  const [likes, saves, comments] = await Promise.all([
    supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", user.id),
    supabase.from("saved").select("post_id").eq("post_id", id).eq("user_id", user.id),
    supabase.from("comments").select(threads ? "id, author_id, author_first, author_last, body, created_at, parent_id, edited_at, like_count" : "id, author_id, author_first, author_last, body, created_at").eq("post_id", id).order("created_at", { ascending: true }).limit(200),
  ]);
  const list = (comments.data ?? []) as unknown as ThreadComment[];
  // Which of these comments you liked.
  const { data: myLikes } = threads && list.length ? await supabase.from("comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", list.map((c) => c.id)) : { data: [] };
  const projects = await projectsForPosts(supabase, [post]);

  return (
    <>
      <PostCard post={post} liked={!!likes.data?.length} saved={!!saves.data?.length} own={post.author_id === user.id} index={0} project={post.project_id ? projects[post.project_id] ?? null : null} />
      <section aria-label="Comments" className="mt-4 rounded-3xl border border-line bg-surface/70 p-5">
        <h2 className="text-sm font-medium">{list.length ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comments"}</h2>
        <CommentThread postId={id} comments={list} me={user.id} postAuthor={post.author_id} liked={((myLikes ?? []) as { comment_id: string }[]).map((l) => l.comment_id)} threads={threads} />
        <CommentForm postId={id} />
      </section>
    </>
  );
}
