import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <div className="relative isolate min-h-dvh">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Logo />
        <div className="mt-14">
          <Suspense fallback={<div className="h-96 shimmer rounded-3xl" aria-busy="true" />}>
            <Onboarding />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Onboarding() {
  const { user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (profile?.onboarded) redirect("/feed");
  const student = profile?.account_type === "student";
  // Graduation year is asked of students only, once supabase/grad-year.sql has run.
  const askGradYear = student && (await dbFeatures()).gradYear;
  return <OnboardingForm firstName={profile?.first_name ?? ""} student={student} askGradYear={askGradYear} />;
}
