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
  const { user } = await getViewer();
  if (!user) redirect("/login?next=/settings/tools");
  if (!(await dbFeatures()).mcp) return <p className="mt-6 text-sm text-muted">Connecting tools isn&apos;t switched on yet.</p>;
  return <ToolsHub tokens={await listApiTokens()} endpoint={`${env.siteUrl}/api/mcp`} />;
}
