import { ArrowRight, Landmark } from "lucide-react";
import Link from "next/link";
import { dbFeatures } from "@/lib/db-features";

// "Starting a chapter?" (Linear FIX-71): the way into /chapters/new from club creation and onboarding.
// Only once chapters exist in the database (supabase/chapters.sql).
export async function StartChapterCard({ className = "" }: { className?: string }) {
  if (!(await dbFeatures()).chapters) return null;
  return (
    <Link href="/chapters/new" className={`group flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 transition hover:border-line-strong ${className}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-text text-surface"><Landmark className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Starting a chapter of a national org?</span>
        <span className="block text-sm text-muted">NSBE and others: your chapter gets its own feed, invite link and weekly roster.</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
    </Link>
  );
}
