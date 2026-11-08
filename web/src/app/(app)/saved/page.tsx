import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton } from "@/components/app/page-ui";
import { type Post } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { PostCard } from "../feed/post-card";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<><PageHeader title="Saved" /><Skeleton className="mt-6 h-64" /></>}>
        <Saved />
      </Suspense>
    </div>
  );
}

async function Saved() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("saved")
    .select("saved_at, posts(id, author_id, author_first, author_last, author_headline, body, kind, tags, like_count, comment_count, created_at, community_name)")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false })
    .limit(100);
  const posts = ((data ?? []) as unknown as { posts: Post | null }[]).map((r) => r.posts).filter((p): p is Post => !!p);
  const { data: likes } = posts.length ? await supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", posts.map((p) => p.id)) : { data: [] };
  const liked = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));

  return (
    <>
      <PageHeader title="Saved" subtitle="Only you can see what you save." />
      <div className="mt-6 flex flex-col gap-4">
        {posts.map((p, i) => <PostCard key={p.id} post={p} liked={liked.has(p.id)} saved own={p.author_id === user.id} index={i} />)}
        {!posts.length && <EmptyState icon={<Bookmark className="size-5" />} title="Nothing saved yet" body="Use the bookmark on any post to keep it here." action={<Link href="/feed" className="text-sm underline underline-offset-4">Go to your feed</Link>} />}
      </div>
    </>
  );
}
