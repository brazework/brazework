import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { ClaimForm, WithdrawClaim } from "@/components/clubs/claim";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Claim a club" };

// Claiming a club someone else started (supabase/club-claims.sql): the officer says their role and
// how to check it; a Brazework admin decides on /admin.
export default function ClaimPage({ params }: PageProps<"/c/[id]/claim">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<><PageHeader title="Claim this club" /><Skeleton className="mt-6 h-72" /></>}>
        <Claim params={params} />
      </Suspense>
    </div>
  );
}

async function Claim({ params }: { params: PageProps<"/c/[id]/claim">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  if (!(await dbFeatures()).clubClaims) notFound();
  const [{ data: club }, { data: me }, { data: claims }] = await Promise.all([
    supabase.from("communities").select("id, name, owner_name").eq("id", id).maybeSingle(),
    supabase.from("community_members").select("role").eq("community_id", id).eq("uid", user.id).maybeSingle(),
    supabase.from("club_claims").select("id, status, role_title, decision_note, created_at").eq("community_id", id).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!club) notFound();
  const latest = (claims ?? [])[0] as { id: number; status: string; role_title: string; decision_note: string } | undefined;
  const back = <Link href={`/c/${club.id}?tab=about`} className="text-sm text-muted hover:text-text">← Back to {club.name}</Link>;

  return (
    <>
      <PageHeader title={`Claim ${club.name}`} subtitle="For a chapter's real officers when someone else started the club on Brazework." />
      <Panel className="mt-6 flex flex-col gap-4 p-6">
        {me?.role === "owner" ? (
          <p className="text-sm text-text-2">You already own this club.</p>
        ) : latest?.status === "open" ? (
          <>
            <p className="text-sm text-text-2">Your claim as <span className="font-medium text-text">{latest.role_title}</span> is with the Brazework team. You&apos;ll get a notification when it&apos;s decided.</p>
            <div><WithdrawClaim id={latest.id} cid={club.id} /></div>
          </>
        ) : (
          <>
            {latest?.status === "denied" && (
              <p className="rounded-2xl bg-surface-2 p-3 text-sm text-text-2">Your last claim wasn&apos;t approved{latest.decision_note ? `: ${latest.decision_note}` : "."} You can send a new one with more to check.</p>
            )}
            <div className="text-sm leading-relaxed text-text-2">
              <p>If it&apos;s approved, you become the owner. {club.owner_name || "The person who started it"} stays in the club as a member, and the club&apos;s members, posts, events and verified work don&apos;t change.</p>
              <p className="mt-2 text-faint">You need a school email on your account. The Brazework team checks every claim by hand.</p>
            </div>
            <ClaimForm cid={club.id} clubName={club.name} />
          </>
        )}
        <div>{back}</div>
      </Panel>
    </>
  );
}
