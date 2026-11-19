import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/app/page-ui";
import { listApiTokens } from "@/lib/api-tokens";
import { dbFeatures } from "@/lib/db-features";
import { env } from "@/lib/env";
import { getViewer } from "@/lib/supabase/server";
import { ToolsHub } from "./tools-client";

export const metadata: Metadata = { title: "Your tools" };

// Settings → Your tools (Linear FIX-78): connect Brazework to the AI coding tools you already build
// with (Claude Code, Cursor, VS Code, Codex, Windsurf, Zed) through Brazework's MCP server.
export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <PageHeader title="Your tools" subtitle="Bring Brazework into the editor and agent you already build with." />
      <Suspense fallback={<Skeleton className="mt-6 h-[520px]" />}>
        <Tools />
      </Suspense>
    </div>
  );
}

async function Tools() {
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login?next=/settings/tools");
  const f = await dbFeatures();
  if (!f.mcp) return <p className="mt-6 text-sm text-muted">Connecting tools isn&apos;t switched on yet.</p>;
  // Your projects, for the GitHub Actions workflow (which project its drafts go to).
  // Your projects and clubs, for the GitHub Actions workflow (which project its drafts go to, and
  // which club, if any, is asked to verify them).
  const [{ data: projects }, { data: clubs }] = f.mcpWorkflows ? await Promise.all([
    supabase.from("projects").select("id, title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("community_members").select("community_id, communities(name)").eq("uid", user.id).limit(50),
  ]) : [{ data: [] }, { data: [] }];
  const clubList = ((clubs ?? []) as unknown as { community_id: string; communities: { name: string } | null }[]).map((c) => ({ id: c.community_id, name: c.communities?.name ?? c.community_id }));
  return <ToolsHub tokens={await listApiTokens()} endpoint={`${env.siteUrl}/api/mcp`} writes={f.mcpWrites} drafts={f.mcpWorkflows}
    projects={(projects ?? []) as { id: string; title: string }[]} clubs={clubList} field={profile?.field ?? ""} />;
}
