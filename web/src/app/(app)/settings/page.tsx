import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { listApiTokens } from "@/lib/api-tokens";
import { isConnected } from "@/lib/tool-setup";
import { getViewer } from "@/lib/supabase/server";
import { AiToolsSettings, AppearanceSettings, BlockedList, EmailSettings, EmberSettings, HelpSettings, MessagingSettings, PasswordForm, ProfileSettings, YourDataSettings } from "./settings-client";
import { OnlineStatusSetting, SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <PageHeader title="Settings" subtitle="Your profile, how Brazework looks, who can reach you, and your account." />
      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        <div className="pt-6"><SettingsNav /></div>
        <div>
          <Suspense fallback={<Skeleton className="mt-6 h-[600px]" />}>
            <Settings />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-24">
      <Kicker>{title}</Kicker>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      <Panel className="mt-3 p-6">{children}</Panel>
    </section>
  );
}

async function Settings() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const { copilotChats: saving, mcp: mcpOn, gradYear: gradYearOn } = await dbFeatures();
  const tokens = mcpOn ? await listApiTokens() : [];
  const [ms, blocks, chatCount, ep, gy, ea] = await Promise.all([
    supabase.from("message_settings").select("requests_on, who_can_message").eq("user_id", user.id).maybeSingle(),
    supabase.from("message_blocks").select("blocked, created_at").eq("blocker", user.id).order("created_at", { ascending: false }),
    saving ? supabase.from("copilot_chats").select("id", { count: "exact", head: true }).eq("user_id", user.id) : Promise.resolve({ count: 0 }),
    // Before email-digest.sql there's no table; the section stays hidden.
    supabase.from("email_prefs").select("weekly_digest").eq("user_id", user.id).maybeSingle(),
    gradYearOn ? supabase.from("profiles").select("grad_year").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Before email-alerts.sql these columns don't exist; the alert switches stay hidden.
    supabase.from("email_prefs").select("alert_messages, alert_requests, alert_comments").eq("user_id", user.id).maybeSingle(),
  ]);
  // undefined hides the field (grad-year.sql hasn't run); null means not set.
  const gradYear = gradYearOn ? ((gy.data as { grad_year: number | null } | null)?.grad_year ?? null) : undefined;
  const emailOn = !ep.error;
  const a = ea.data as { alert_messages: boolean; alert_requests: boolean; alert_comments: boolean } | null;
  const alerts = ea.error ? undefined : { messages: a?.alert_messages ?? true, requests: a?.alert_requests ?? true, comments: a?.alert_comments ?? true };
  const ids = (blocks.data ?? []).map((b) => b.blocked as string);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids) : { data: [] };
  const blocked = ids.map((id) => {
    const p = (people ?? []).find((x: { id: string }) => x.id === id) as { first_name: string; last_name: string } | undefined;
    return { id, name: p ? `${p.first_name} ${p.last_name}`.trim() : "Former member" };
  });

  return (
    <>
      <Section id="profile" title="Profile" desc="What people see on your profile and posts."><ProfileSettings profile={profile} gradYear={gradYear} /></Section>
      <Section id="appearance" title="Appearance" desc="Light or dark, and the colour theme."><AppearanceSettings /></Section>
      {emailOn && <Section id="email" title="Email" desc="What Brazework sends to your inbox. Sign-in emails always come."><EmailSettings weekly={ep.data ? Boolean(ep.data.weekly_digest) : true} alerts={alerts} /></Section>}
      <Section id="messaging" title="Messaging and privacy" desc="Who can message you, and whether you show as online."><OnlineStatusSetting /><div className="my-6 border-t border-line" /><MessagingSettings requestsOn={ms.data ? Boolean(ms.data.requests_on) : true} who={(ms.data?.who_can_message as "everyone" | "communities" | "connections") ?? "everyone"} /></Section>
      <Section id="blocked" title="Blocked people" desc="People who can't message you or see your activity."><BlockedList people={blocked} /></Section>
      <Section id="ember" title="Ember and your data" desc="What Brazework's AI teammate can see, what it can do, and your chats with it."><EmberSettings saving={saving} chats={chatCount.count ?? 0} /></Section>
      {mcpOn && <Section id="ai-tools" title="Your tools" desc="Use your Brazework from Claude Code, Cursor, VS Code, Codex and other AI tools."><AiToolsSettings connected={tokens.filter((t) => !t.revoked_at && isConnected(t)).length} total={tokens.filter((t) => !t.revoked_at).length} /></Section>}
      <Section id="data" title="Your data" desc="Download everything you've put on Brazework, or delete your account."><YourDataSettings /></Section>
      <Section id="help" title="Help" desc="Tours, what's new, and how to reach us."><HelpSettings /></Section>
      <Section id="account" title="Account" desc="Your sign-in email, password and session.">
        <p className="text-sm text-muted">Signed in as <span className="text-text">{user.email}</span></p>
        <PasswordForm />
        <form action="/auth/signout" method="post" className="mt-6 border-t border-line pt-6">
          <button className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm transition hover:bg-hover">Log out</button>
        </form>
      </Section>
    </>
  );
}
