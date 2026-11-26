import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton } from "@/components/app/page-ui";
import { Button } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import type { ToolDraft } from "@/lib/tool-drafts";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { draftToProposal, isCardKind } from "@/lib/tool-actions";
import { DraftCard } from "./draft-card";

export const metadata: Metadata = { title: "Drafts" };

// Drafts (docs/mcp-workflows.md): what your tools left for you, an automation on a merged pull
// request or your assistant when you said "later". Nothing here is posted until you approve it.
// Posts and milestones have their own card; every other action (a project, a teammate, …) is the
// same card Jig shows (supabase/tool-actions.sql), and Confirm runs the app's own action.
export default function DraftsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Drafts" subtitle="What your tools drafted for your record. Edit it, then post it, or dismiss it. Nothing goes out until you do." />
      <Suspense fallback={<Skeleton className="mt-6 h-64" />}>
        <Drafts />
      </Suspense>
    </div>
  );
}

async function Drafts() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login?next=/drafts");
  if (!(await dbFeatures()).mcpWorkflows) return <p className="mt-6 text-sm text-muted">Drafts aren&apos;t switched on yet.</p>;
  const { data } = await supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload").eq("status", "waiting").order("created_at", { ascending: false }).limit(30);
  const drafts = (data ?? []) as ToolDraft[];
  if (!drafts.length) {
    return (
      <div className="mt-6">
        <EmptyState icon={<Inbox className="size-5" />} title="No drafts waiting"
          body="When a tool can't ask you right away (a GitHub Action on a merged pull request, or your assistant when you say “later”), what it drafts for your record waits here."
          action={<Button href="/settings/tools" variant="outline">Connect a tool</Button>} />
      </div>
    );
  }
  // Names for the project and club each draft is about (row-level security: only what you can see).
  const own = drafts.filter((d) => !isCardKind(d.kind));
  const projectIds = [...new Set(own.map((d) => d.payload.project_id).filter((x): x is string => typeof x === "string" && !!x))];
  const clubIds = [...new Set(own.map((d) => d.payload.club_id).filter((x): x is string => typeof x === "string" && !!x))];
  const [{ data: projects }, { data: clubs }] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, title").in("id", projectIds) : Promise.resolve({ data: [] }),
    clubIds.length ? supabase.from("communities").select("id, name").in("id", clubIds) : Promise.resolve({ data: [] }),
  ]);
  const projectName = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const clubName = new Map(((clubs ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return (
    <ul className="mt-6 space-y-4" aria-label="Waiting drafts">
      {drafts.map((d) => {
        const card = isCardKind(d.kind) ? draftToProposal(d) : null;
        if (card) return <li key={d.id}><ProposalCard p={card} fromTool={{ draftId: d.id, via: d.via, source: d.source }} /></li>;
        return (
        <li key={d.id}>
          <DraftCard draft={d} project={d.payload.project_id ? projectName.get(d.payload.project_id) ?? null : null} club={d.payload.club_id ? clubName.get(d.payload.club_id) ?? null : null} />
        </li>
        );
      })}
    </ul>
  );
}
