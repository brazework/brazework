import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, Skeleton } from "@/components/app/page-ui";
import { Avatar } from "@/components/ui";
import { timeAgo, type Post } from "@/lib/forge";
import { projectsForPosts } from "@/lib/project-posts";
import { postSelect } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { PostCard } from "../../feed/post-card";
import { CommentForm, DeleteComment } from "./comments-client";

export const metadata: Metadata = { title: "Post" };

type Comment = { id: string; author_id: string; author_first: string; author_last: string; body: string; created_at: string };

// One post with its comments: /post/<id>. Notifications link here.
export default function PostPage({ params }: PageProps<"/post/[id]">) {
  return (
    <div className="mx-auto max-w-2xl">
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

  const [likes, saves, comments] = await Promise.all([
    supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", user.id),
    supabase.from("saved").select("post_id").eq("post_id", id).eq("user_id", user.id),
    supabase.from("comments").select("id, author_id, author_first, author_last, body, created_at").eq("post_id", id).order("created_at", { ascending: true }).limit(100),
  ]);
  const list = (comments.data ?? []) as Comment[];
  const projects = await projectsForPosts(supabase, [post]);

  return (
    <>
      <PostCard post={post} liked={!!likes.data?.length} saved={!!saves.data?.length} own={post.author_id === user.id} index={0} project={post.project_id ? projects[post.project_id] ?? null : null} />
      <section aria-label="Comments" className="mt-4 rounded-3xl border border-line bg-surface/70 p-5">
        <h2 className="text-sm font-medium">{list.length ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comments"}</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {list.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Link href={`/u/${c.author_id}`} aria-hidden="true" tabIndex={-1}><Avatar first={c.author_first} last={c.author_last} size={32} /></Link>
              <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 py-2.5">
                <div className="flex items-baseline gap-2 text-sm">
                  <Link href={`/u/${c.author_id}`} className="font-medium hover:underline">{c.author_first} {c.author_last}</Link>
                  <span className="text-xs text-faint">{timeAgo(c.created_at)}</span>
                  {(c.author_id === user.id || post.author_id === user.id) && <DeleteComment postId={id} commentId={c.id} />}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{c.body}</p>
              </div>
            </li>
          ))}
          {!list.length && <li className="text-sm text-muted">No comments yet. Start the conversation.</li>}
        </ul>
        <CommentForm postId={id} />
      </section>
    </>
  );
}
