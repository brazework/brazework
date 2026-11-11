import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/app/page-ui";
import { Seal } from "@/components/app/verified-seal";
import { TOPICS } from "@/lib/forge";
import { proQueue, proState } from "@/lib/pro";
import { ProSetup, ReviewCard } from "./pro-client";

export const metadata: Metadata = { title: "Pro reviews" };

// /pro (Linear FIX-72): engineers at a verified company sign off members' club-verified milestones
// with a note on what they checked. Light commitment: a queue in your areas, oldest first.
export default function ProPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pro reviews" subtitle="Your sign-off is the strongest proof a student can show: a working engineer checked the work." />
      <Suspense fallback={<div className="h-80 shimmer rounded-3xl" />}><Pro /></Suspense>
    </div>
  );
}

async function Pro() {
  const s = await proState();
  if (!s) notFound();
  if (!s.employer)
    return (
      <Panel className="p-6 text-sm">
        <Building2 className="size-5 text-muted" />
        <p className="mt-3 font-medium">Pro reviews need your work email</p>
        <p className="mt-1 text-muted">Sign-offs carry your employer&apos;s name, so they come from an account whose email is at a verified company on Brazework. Log in with your work email, or register your company first.</p>
        <Link href="/org" className="mt-4 inline-flex h-10 items-center rounded-full border border-line px-4 font-medium transition hover:bg-hover">Register your company</Link>
      </Panel>
    );
  if (!s.pro) return <ProSetup employer={s.employer.name} groups={TOPICS.map((g) => ({ name: g.name, topics: [...g.topics] }))} />;

  const queue = await proQueue();
  return (
    <>
      <Panel className="mb-4 flex items-center gap-3 p-4">
        <Seal size={30} tone="pro" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{s.title} at {s.employer.name}</p>
          <p className="truncate text-xs text-muted">Your areas: {s.disciplines.join(", ")}</p>
        </div>
      </Panel>
      {queue.length ? (
        <section aria-label="Review queue" className="flex flex-col gap-3">
          {queue.map((m) => <ReviewCard key={m.id} m={m} />)}
        </section>
      ) : (
        <Panel className="p-6 text-sm text-muted">Nothing waiting right now. Club-verified milestones show up here as members earn them.</Panel>
      )}
    </>
  );
}
