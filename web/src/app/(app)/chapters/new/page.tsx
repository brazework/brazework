import type { Metadata } from "next";
import { School } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/app/page-ui";
import { chapterSetup } from "@/lib/chapters";
import { ChapterForm } from "./form";

export const metadata: Metadata = { title: "Start a chapter" };

// /chapters/new (Linear FIX-71): a chapter lead starts their chapter in under two minutes. The school
// comes from their school email; they pick the national organization and who can join.
export default function NewChapterPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Start your chapter" subtitle="Your chapter's own feed, weekly streaks, and milestones your officers verify. It takes a minute." />
      <Suspense fallback={<div className="h-80 shimmer rounded-3xl" />}><Setup /></Suspense>
    </div>
  );
}

async function Setup() {
  const setup = await chapterSetup();
  if (!setup) notFound();
  if (!setup.school)
    return (
      <Panel className="p-6 text-sm">
        <School className="size-5 text-muted" />
        <p className="mt-3 font-medium">Start a chapter from your school email</p>
        <p className="mt-1 text-muted">Chapters belong to a school, and members trust it&apos;s really theirs because the lead signed up with that school&apos;s email. Log in with your school account, or ask us to add your school.</p>
        <Link href="/request-school" className="mt-4 inline-flex h-10 items-center rounded-full border border-line px-4 font-medium transition hover:bg-hover">Request your school</Link>
      </Panel>
    );
  if (!setup.networks.length) return <Panel className="p-6 text-sm text-muted">No national organizations are on Brazework yet.</Panel>;
  return <ChapterForm school={setup.school.school} networks={setup.networks} />;
}
