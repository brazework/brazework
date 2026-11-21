import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { needsLinkedin } from "@/lib/linkedin-gate";
import { isProvider, namesFrom, providerLabel } from "@/lib/oauth";
import { FinishSignupForm } from "./finish-signup-form";
import { FirstBuildWizard, type WizardClub } from "./first-build-wizard";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Your first build" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <div className="relative isolate min-h-dvh">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Logo />
        <div className="mt-14">
          <Suspense fallback={<div className="h-96 shimmer rounded-3xl" aria-busy="true" />}>
            <Onboarding searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  // Signed up but no profile yet: "About you" (account type, name, birthday) comes first, for every
  // way in. A provider's sign-up starts the names from what it shared.
  if (!profile) {
    const { data } = await supabase.auth.getClaims();
    const claims = (data?.claims ?? {}) as { user_metadata?: unknown; app_metadata?: { provider?: string } };
    const via = claims.app_metadata?.provider;
    // A professional is offered a LinkedIn link here (optional), once supabase/linkedin-required.sql has run.
    return <FinishSignupForm email={user.email} provider={isProvider(via) ? providerLabel(via) : undefined} {...namesFrom(claims.user_metadata)} askLinkedin={(await dbFeatures()).linkedinRequired} />;
  }
  if (profile?.onboarded) redirect("/feed");
  const student = profile?.account_type === "student";
  // Build-first (the Product Hunt launch): the way in is the first milestone. Someone who hasn't
  // built anything yet can set up their profile instead (?path=profile), the form as it was.
  if ((await searchParams).path !== "profile") {
    // Clubs that can sign it: theirs (an invite they followed), then open clubs, biggest first. The
    // wizard puts the ones in the field they pick at the top.
    const [mine, open] = await Promise.all([
      supabase.from("community_members").select("community:communities(id, name, field, member_count)").eq("uid", user.id).limit(10),
      supabase.from("communities").select("id, name, field, member_count").eq("privacy", "public").neq("type", "study").order("member_count", { ascending: false }).limit(60),
    ]);
    type Row = { id: string; name: string; field: string | null; member_count: number };
    const own = ((mine.data ?? []) as unknown as { community: Row | null }[]).map((m) => m.community).filter((c): c is Row => !!c);
    const ids = new Set(own.map((c) => c.id));
    const clubs: WizardClub[] = [
      ...own.map((c) => ({ id: c.id, name: c.name, field: c.field ?? "", members: c.member_count, mine: true })),
      ...((open.data ?? []) as Row[]).filter((c) => !ids.has(c.id)).map((c) => ({ id: c.id, name: c.name, field: c.field ?? "", members: c.member_count, mine: false })),
    ];
    // A working account adds its LinkedIn link before asking a person to sign (Linear FIX-214): the
    // last screen offers the field to one that has none.
    return <FirstBuildWizard firstName={profile.first_name ?? ""} student={student} userId={user.id} clubs={clubs} askLinkedin={!student && (await needsLinkedin(supabase))} />;
  }
  // Graduation year is asked of students only, once supabase/grad-year.sql has run.
  const askGradYear = student && (await dbFeatures()).gradYear;
  return <OnboardingForm firstName={profile?.first_name ?? ""} student={student} askGradYear={askGradYear} />;
}
