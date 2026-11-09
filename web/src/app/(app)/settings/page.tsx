import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { getViewer } from "@/lib/supabase/server";
import { AppearanceSettings, BlockedList, HelpSettings, MessagingSettings, PasswordForm, ProfileSettings } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl xl:max-w-3xl">
      <PageHeader title="Settings" />
      <Suspense fallback={<Skeleton className="mt-6 h-[600px]" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-24">
      <Kicker>{title}</Kicker>
      <Panel className="mt-3 p-6">{children}</Panel>
    </section>
  );
}

async function Settings() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const [ms, blocks] = await Promise.all([
    supabase.from("message_settings").select("requests_on, who_can_message").eq("user_id", user.id).maybeSingle(),
    supabase.from("message_blocks").select("blocked, created_at").eq("blocker", user.id).order("created_at", { ascending: false }),
  ]);
  const ids = (blocks.data ?? []).map((b) => b.blocked as string);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids) : { data: [] };
  const blocked = ids.map((id) => {
    const p = (people ?? []).find((x: { id: string }) => x.id === id) as { first_name: string; last_name: string } | undefined;
    return { id, name: p ? `${p.first_name} ${p.last_name}`.trim() : "Former member" };
  });

  return (
    <>
      <Section id="profile" title="Profile"><ProfileSettings profile={profile} /></Section>
      <Section id="appearance" title="Appearance"><AppearanceSettings /></Section>
      <Section id="messaging" title="Messaging"><MessagingSettings requestsOn={ms.data ? Boolean(ms.data.requests_on) : true} who={(ms.data?.who_can_message as "everyone" | "communities" | "connections") ?? "everyone"} /></Section>
      <Section id="blocked" title="Blocked people"><BlockedList people={blocked} /></Section>
      <Section id="help" title="Help"><HelpSettings /></Section>
      <Section id="account" title="Account">
        <p className="text-sm text-muted">Signed in as <span className="text-text">{user.email}</span></p>
        <PasswordForm />
        <form action="/auth/signout" method="post" className="mt-6 border-t border-line pt-6">
          <button className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm transition hover:bg-hover">Log out</button>
        </form>
      </Section>
    </>
  );
}
