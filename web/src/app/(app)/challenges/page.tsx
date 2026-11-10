import type { Metadata } from "next";
import { ArrowRight, Building2, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { STATUS_LABEL, daysLeft, type Challenge } from "./shared";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage({ searchParams }: PageProps<"/challenges">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <Suspense fallback={<><PageHeader title="Challenges" /><Skeleton className="mt-6 h-96" /></>}>
        <Challenges searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Challenges({ searchParams }: { searchParams: PageProps<"/challenges">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  if (!(await dbFeatures()).challenges) {
    return (
      <>
        <PageHeader title="Challenges" />
        <EmptyState title="Challenges aren't switched on yet" body="They turn on once the database update in supabase/challenges.sql is applied." />
      </>
    );
  }
  const tab = sp.tab === "past" || sp.tab === "mine" ? sp.tab : "open";
  const [{ data }, { data: admin }, { data: mine }] = await Promise.all([
    supabase.from("challenges").select("id, org_id, title, brief, prize, topic, deadline, status, sponsorship, organizations(name)").order("deadline", { ascending: true }).limit(200),
    supabase.from("organization_admins").select("org_id, organizations(verification_status, type)").eq("uid", user.id).limit(1),
    supabase.from("challenge_entries").select("challenge_id").eq("uid", user.id).limit(200),
  ]);
  const all = (data ?? []) as unknown as Challenge[];
  const entered = new Set((mine ?? []).map((r) => r.challenge_id as string));
  const sponsor = (admin?.[0] as unknown as { org_id: string; organizations: { verification_status: string; type: string } | null } | undefined);
  const canPost = !!sponsor && sponsor.organizations?.verification_status === "verified" && sponsor.organizations.type !== "forge";
  const ours = (c: Challenge) => !!sponsor && c.org_id === sponsor.org_id;
  const list = tab === "open" ? all.filter((c) => c.status === "open")
    : tab === "past" ? all.filter((c) => c.status === "judging" || c.status === "closed").reverse()
    : all.filter((c) => entered.has(c.id) || ours(c));
  const { data: counts } = list.length ? await supabase.rpc("challenge_entry_counts", { p_ids: list.map((c) => c.id) }) : { data: [] };
  const n = new Map(((counts ?? []) as { challenge_id: string; entries: number }[]).map((r) => [r.challenge_id, Number(r.entries)]));
  const now = requestTime();

  return (
    <>
      <PageHeader
        title="Challenges"
        subtitle="Build briefs from companies and schools. Enter with a project, and the sponsor sees your verified work."
        actions={canPost ? <Link href="/challenges/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-[var(--shadow)] transition hover:opacity-90"><Plus className="size-4" /> Post a challenge</Link> : undefined}
      />
      <div className="mt-6">
        <Tabs active={tab} tabs={[
          { id: "open", label: "Open", href: "/challenges", count: all.filter((c) => c.status === "open").length },
          { id: "mine", label: canPost ? "Yours" : "Entered", href: "/challenges?tab=mine" },
          { id: "past", label: "Past", href: "/challenges?tab=past" },
        ]} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {list.map((c) => {
          const left = daysLeft(c.deadline, now);
          return (
            <Link key={c.id} href={`/challenges/${c.id}`} className="glass-card group flex min-w-0 flex-col gap-3 rounded-3xl p-5 transition hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-faint">
                <Building2 className="size-3.5" /> <span className="truncate">{c.organizations?.name ?? "Sponsor"}</span>
                <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">
                  {c.status === "open" ? (left > 0 ? `${left} ${left === 1 ? "day" : "days"} left` : "Closing today") : STATUS_LABEL[c.status]}
                </span>
              </div>
              <div>
                <h2 className="text-lg leading-snug font-semibold">{c.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.brief}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
                {c.prize && <span className="inline-flex items-center gap-1 font-medium text-text"><Trophy className="size-3.5" /> {c.prize}</span>}
                {c.topic && <span>{c.topic}</span>}
                <span>{n.get(c.id) ?? 0} {(n.get(c.id) ?? 0) === 1 ? "entry" : "entries"}</span>
                {entered.has(c.id) && <span className="rounded-full bg-ok/12 px-2 py-0.5 text-ok">You entered</span>}
                <ArrowRight className="ml-auto size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-text" />
              </div>
            </Link>
          );
        })}
      </div>
      {!list.length && (
        <EmptyState
          icon={<Trophy className="size-5" />}
          title={tab === "open" ? "No open challenges right now" : tab === "past" ? "No past challenges yet" : canPost ? "You haven't posted a challenge" : "You haven't entered a challenge"}
          body={canPost ? "Post a brief, sponsor it, and every club on Forge can enter." : "When a company or school sponsors a build challenge, it shows up here. Keep adding verified work to your projects so you're ready."}
          action={canPost ? <Link href="/challenges/new" className="text-sm font-medium underline">Post a challenge</Link> : undefined}
        />
      )}
    </>
  );
}
