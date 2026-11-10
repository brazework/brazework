import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Button } from "@/components/ui";
import { getViewer } from "@/lib/supabase/server";
import { CreateChallengeForm } from "../challenge-client";

export const metadata: Metadata = { title: "Post a challenge" };

export default function NewChallengePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl"><PageHeader title="Post a challenge" /><Skeleton className="mt-6 h-96" /></div>}>
      <NewChallenge />
    </Suspense>
  );
}

async function NewChallenge() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase.from("organization_admins").select("org_id, organizations(name, verification_status, type)").eq("uid", user.id).limit(1);
  const row = data?.[0] as unknown as { org_id: string; organizations: { name: string; verification_status: string; type: string } | null } | undefined;
  const ok = row?.organizations?.verification_status === "verified" && row.organizations.type !== "forge";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Post a challenge" subtitle={ok ? `As ${row!.organizations!.name}. You'll save a draft, sponsor it, then publish it to every club.` : "Challenges are posted by verified companies and schools."} />
      <Panel className="mt-6 p-6">
        {ok ? <CreateChallengeForm orgId={row!.org_id} /> : <div className="flex flex-col items-start gap-3"><p className="text-sm text-muted">Register your organization with a work email on its domain first.</p><Button href="/org">Register your organization</Button></div>}
      </Panel>
    </div>
  );
}
