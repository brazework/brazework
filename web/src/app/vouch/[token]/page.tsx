import type { Metadata } from "next";
import { ExternalLink, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { RELATIONSHIPS } from "@/lib/vouch-email";
import { previewVouch } from "@/lib/vouches";
import { AnswerForm } from "./answer-form";

// /vouch/<token>: someone a member asked (a professor, TA, PI, manager, mentor) vouches for one
// milestone, or declines (supabase/vouches.sql, Linear FIX-94). Works signed out: the link, emailed to
// their university or company address, is the proof. The URL is a secret, so it's never indexed and
// never sent on as a referrer (evidence links open without one).
export const metadata: Metadata = {
  title: "Vouch for their work",
  description: "Someone asked you to vouch for a milestone on Brazework.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VouchPage({ params }: PageProps<"/vouch/[token]">) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-6 py-16">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-lg">
        <Link href="/" aria-label="Brazework home" className="mb-10 inline-block"><Logo /></Link>
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" />}>
          <Vouch params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Vouch({ params }: { params: PageProps<"/vouch/[token]">["params"] }) {
  const { token } = await params;
  const v = await previewVouch(token);
  if (!v || v.state !== "asked") {
    const why = !v ? "This link isn't valid." : v.state === "expired" ? "This link has expired." : v.state === "vouched" ? "You've already vouched for this. Thank you." : v.state === "declined" ? "You declined this one." : "This ask was closed.";
    return (
      <section className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow)]">
        <h1 className="text-xl font-semibold tracking-tight">{why}</h1>
        <p className="mt-2 text-sm text-muted">If they still need a vouch, they can send you a new link from Brazework.</p>
      </section>
    );
  }
  const links = [v.evidence, ...v.evidence_items.map((e) => e.url ?? "")].filter((u): u is string => /^https:\/\//.test(u));
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] sm:p-7">
      <p className="text-sm text-muted"><b className="font-semibold text-text">{v.member || "A student"}</b> listed you as {RELATIONSHIPS[v.relationship]} who saw this happen.</p>
      <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-4">
        {v.project && <p className="text-xs font-medium text-faint">{v.project}</p>}
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight">{v.title}</h1>
        {v.detail && <p className="mt-1.5 text-sm leading-relaxed text-text-2">{v.detail}</p>}
        {links.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {links.map((u) => (
              <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"><FileCheck2 className="size-4 shrink-0" /><span className="truncate">{u.replace(/^https:\/\//, "")}</span><ExternalLink className="size-3.5 shrink-0 text-faint" /></a></li>
            ))}
          </ul>
        )}
      </div>
      <AnswerForm token={token} domain={v.email.split("@")[1] ?? ""} />
    </section>
  );
}
