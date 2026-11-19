import { ArrowRight, Clock, Mail, PartyPopper, Users } from "lucide-react";
import Link from "next/link";
import { Celebrate } from "@/components/app/celebrate";
import { CopyLink } from "@/components/app/copy-link";
import type { createClient } from "@/lib/supabase/server";
import type { Milestone } from "./milestones";

// The end of build-first onboarding (/u/<id>?welcome=1, owner only): your first milestone is on your
// record, and this says where it stands. It never says "verified": only a person's signature does.
export async function FirstMilestoneWelcome({ supabase, userId, milestone }: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; milestone: Milestone | undefined }) {
  let line = "Your profile is ready. Log your first build from Home whenever you're ready.";
  let Icon = PartyPopper;
  if (milestone) {
    if (milestone.status === "pending" && milestone.community_id) {
      line = `“${milestone.title}” is on your record, waiting for ${milestone.community_name || "your club"}'s officers to verify it.`;
      Icon = Users;
    } else if (milestone.status === "pending") {
      const { data } = await supabase.from("milestone_vouches").select("email").eq("milestone_id", milestone.id).eq("state", "asked").order("created_at", { ascending: false }).limit(1).maybeSingle();
      line = `“${milestone.title}” is on your record, waiting for ${data?.email ?? "the person you asked"} to sign it. We emailed them, and you'll be notified when they answer.`;
      Icon = Mail;
    } else if (milestone.status === "draft") {
      line = `“${milestone.title}” is on your record as a draft. Add proof and ask who saw it, from the milestone below.`;
      Icon = Clock;
    } else {
      line = `“${milestone.title}” is on your record.`;
    }
  }
  return (
    <section aria-label="Welcome to Brazework" className="border border-line bg-surface relative mb-4 overflow-hidden rounded-2xl p-5 sm:p-6">
      <Celebrate pieces={22} />
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-text text-surface"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">You&apos;re on Brazework.</h2>
          <p className="mt-1 text-[15px] text-text-2">{line}</p>
          <p className="mt-1 text-sm text-muted">{milestone?.status === "pending" ? <>Post it today: <strong className="font-medium text-text">Share</strong> on the milestone below makes a card that says it&apos;s waiting, and it becomes the signed card when they sign.</> : <>Once someone signs it, it gets a share card you can post anywhere.</>}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyLink path={`/u/${userId}`} label="Copy my profile link" />
            <Link href="/feed" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text px-3.5 text-sm font-medium text-surface transition hover:opacity-90">Go to Today <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
