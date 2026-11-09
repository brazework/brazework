import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Panel, Skeleton, Tabs } from "@/components/app/page-ui";
import { Avatar } from "@/components/ui";
import { PERMS, ROLE_LABEL, ROLES, can, rank, type Ban, type JoinRequest, type Member } from "@/lib/communities";
import { timeAgo } from "@/lib/forge";
import { RoleChip } from "../../../communities/_components/badge";
import { loadCommunity } from "../data";
import { dbFeatures } from "@/lib/db-features";
import { ClubCoverUpload } from "./cover-upload";
import { InviteLinks } from "./invites";
import { env } from "@/lib/env";
import type { Invite } from "../../../communities/actions";
import { BanRow, MemberActions, RequestActions, SettingsForm } from "./manage-client";
import { RecentReviews, VerifyQueue, type QueueItem } from "./verify";
import { ReportView } from "./report";
import { Integrations } from "./integrations";
import { loadClubReport } from "@/lib/club-report";
import { copilotEnabled } from "@/lib/copilot";
import { BadgeCheck } from "lucide-react";

export const metadata: Metadata = { title: "Manage community" };

export default function ManagePage({ params, searchParams }: PageProps<"/c/[id]/manage">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Manage params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Manage({ params, searchParams }: { params: PageProps<"/c/[id]/manage">["params"]; searchParams: PageProps<"/c/[id]/manage">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, community: c, me } = await loadCommunity(id);
  if (!c) notFound();
  const role = me?.role ?? null;
  if (rank(role) < 2) redirect(`/c/${id}`);

  const features = await dbFeatures();
  const canVerify = features.milestones && can(role, "verify");
  // How many milestones are waiting, for the tab's count (head-only, no rows).
  const waiting = canVerify ? (await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("community_id", id).eq("status", "pending")).count ?? 0 : 0;
  const tabs = [
    { id: "report", label: "This week", show: rank(role) >= 3 },
    { id: "integrations", label: "Integrations", show: rank(role) >= 4 },
    { id: "verify", label: "Verify", show: canVerify, count: waiting },
    { id: "invite", label: "Invite", show: can(role, "approve") && features.invites },
    { id: "requests", label: "Requests", show: can(role, "approve") },
    { id: "members", label: "Members", show: true },
    { id: "bans", label: "Bans", show: can(role, "removeMembers") },
    { id: "settings", label: "Settings", show: can(role, "editInfo") },
    { id: "roles", label: "Roles", show: true },
  ].filter((t) => t.show);
  const tab = tabs.find((t) => t.id === sp.tab)?.id ?? (rank(role) >= 3 ? "report" : c.privacy === "approval" && can(role, "approve") ? "requests" : "members");
  // The webhook is a secret: only a masked tail goes to the browser.
  const intg = tab === "integrations" && features.integrations ? (await supabase.from("club_integrations").select("discord_webhook, discord_events, discord_milestones, discord_updates").eq("community_id", id).maybeSingle()).data : null;
  const discord = { connected: !!intg?.discord_webhook, masked: intg?.discord_webhook ? `••••${intg.discord_webhook.slice(-6)}` : "", events: intg?.discord_events ?? true, milestones: intg?.discord_milestones ?? true, updates: intg?.discord_updates ?? true };
  const [report, copilotOn] = tab === "report" ? await Promise.all([loadClubReport(supabase, id, features), copilotEnabled()]) : [null, false];

  const MS_COLS = "id, owner_id, title, detail, evidence, achieved_on, created_at, status, reviewer_name, review_note, project:projects(title, summary), owner:profiles!milestones_owner_id_fkey(first_name, last_name, headline)";
  const [reqs, members, bans, invites, queue, reviewed] = await Promise.all([
    tab === "requests" ? supabase.from("community_requests").select("*").eq("community_id", id).order("at", { ascending: true }).limit(100) : Promise.resolve({ data: [] }),
    tab === "members" ? supabase.from("community_members").select("*").eq("community_id", id).limit(500) : Promise.resolve({ data: [] }),
    tab === "bans" ? supabase.from("community_bans").select("*").eq("community_id", id) : Promise.resolve({ data: [] }),
    tab === "invite" ? supabase.from("community_invites").select("*").eq("community_id", id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    tab === "verify" ? supabase.from("milestones").select(MS_COLS).eq("community_id", id).eq("status", "pending").order("created_at", { ascending: true }).limit(100) : Promise.resolve({ data: [] }),
    tab === "verify" ? supabase.from("milestones").select(MS_COLS).eq("community_id", id).neq("status", "pending").order("reviewed_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const memberList = ((members.data ?? []) as Member[]).sort((a, b) => rank(b.role) - rank(a.role) || a.first_name.localeCompare(b.first_name));

  return (
    <>
      <Link href={`/c/${id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> {c.name}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">Manage</h1>
      <p className="mt-1.5 text-sm text-muted">You&apos;re {role === "admin" ? "an" : "a"} {ROLE_LABEL[role!].toLowerCase()}. You can act on people below your own role.</p>
      <div className="mt-6"><Tabs active={tab} tabs={tabs.map((t) => ({ id: t.id, label: t.label, href: `/c/${id}/manage?tab=${t.id}`, count: "count" in t ? (t.count as number) : undefined }))} /></div>
      <div className="mt-6">
        {tab === "integrations" && <Integrations cid={id} discord={discord} available={features.integrations} />}
        {tab === "report" && report && <ReportView r={report} clubId={id} copilot={copilotOn} />}
        {tab === "verify" && (((queue.data ?? []) as unknown as QueueItem[]).length ? <VerifyQueue items={(queue.data ?? []) as unknown as QueueItem[]} /> : (
          <EmptyState icon={<BadgeCheck className="size-6" />} title="Nothing to verify" body="When members ask the club to vouch for a milestone (a test, a build, a result), it shows up here." />
        ))}
        {tab === "verify" && <RecentReviews items={(reviewed.data ?? []) as unknown as QueueItem[]} />}
        {tab === "invite" && <Panel className="p-6"><InviteLinks cid={id} clubName={c.name} origin={env.siteUrl} invites={(invites.data ?? []) as Invite[]} /></Panel>}
        {tab === "requests" && (((reqs.data ?? []) as JoinRequest[]).length ? (
          <Panel className="divide-y divide-line p-0">
            {((reqs.data ?? []) as JoinRequest[]).map((r) => (
              <div key={r.uid} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar first={r.first_name} last={r.last_name} size={40} />
                <div className="min-w-0 flex-1"><Link href={`/u/${r.uid}`} className="font-medium hover:underline">{r.first_name} {r.last_name}</Link><div className="truncate text-sm text-muted">{r.headline}</div><div className="text-xs text-faint">Asked {timeAgo(r.at)}</div></div>
                <RequestActions cid={id} uid={r.uid} />
              </div>
            ))}
          </Panel>
        ) : <EmptyState title="No requests waiting" body="People who ask to join show up here." />)}

        {tab === "members" && (
          <Panel className="divide-y divide-line p-0">
            {memberList.map((m) => (
              <div key={m.uid} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar first={m.first_name} last={m.last_name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Link href={`/u/${m.uid}`} className="font-medium hover:underline">{m.first_name} {m.last_name}</Link><RoleChip role={m.role} /></div>
                  <div className="truncate text-sm text-muted">{m.headline}</div>
                </div>
                {m.uid !== user.id && rank(m.role) < rank(role) && (can(role, "roles") || can(role, "removeMembers")) && (
                  <MemberActions cid={id} uid={m.uid} name={m.first_name} current={m.role} assignable={can(role, "roles") ? ROLES.filter((r) => rank(r) < rank(role)) : []} canRemove={can(role, "removeMembers")} />
                )}
              </div>
            ))}
          </Panel>
        )}

        {tab === "bans" && (((bans.data ?? []) as Ban[]).length ? (
          <Panel className="divide-y divide-line p-0">{((bans.data ?? []) as Ban[]).map((b) => <BanRow key={b.uid} cid={id} uid={b.uid} name={b.name} at={timeAgo(b.at)} />)}</Panel>
        ) : <EmptyState title="No one is banned" />)}

        {tab === "settings" && features.media && <Panel className="mb-4 p-6"><ClubCoverUpload cid={id} path={c.cover_path} userId={user.id} /></Panel>}
        {tab === "settings" && <Panel className="p-6"><SettingsForm cid={id} about={c.about} rules={c.rules} privacy={c.privacy} words={(c.automod?.words ?? []).join("\n")} holdNewLinks={!!c.automod?.holdNewLinks} canAutomod={can(role, "automod")} /></Panel>}

        {tab === "roles" && (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left"><th className="px-5 py-3 font-medium">Permission</th>{ROLES.map((r) => <th key={r} className="px-3 py-3 text-center font-mono text-[10px] tracking-wide text-muted uppercase">{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>{PERMS.map(([key, label]) => <tr key={key} className="border-b border-line last:border-0"><td className="px-5 py-3 text-text-2">{label}</td>{ROLES.map((r) => <td key={r} className="px-3 py-3 text-center">{can(r, key) ? "✓" : <span className="text-faint">—</span>}</td>)}</tr>)}</tbody>
            </table>
          </Panel>
        )}
      </div>
    </>
  );
}
