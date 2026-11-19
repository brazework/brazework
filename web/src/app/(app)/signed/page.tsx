import type { Metadata } from "next";
import { BadgeCheck, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton } from "@/components/app/page-ui";
import { groupByMember, signedAs } from "@/lib/signatures";
import { getViewer } from "@/lib/supabase/server";
import { mySignatures } from "@/lib/vouches";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "What you've signed" };

// What you've signed (supabase/signer-tools.sql): every vouch sent from your confirmed email, every
// milestone you verified for a club, and every Pro sign-off, grouped by the person you signed for, with
// what you wrote. For recommendation letters and reviews; it prints cleanly.
export default function SignedPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="What you've signed" subtitle="Everyone you've vouched for or verified, with what you wrote. Use it for recommendation letters and reviews." />
      <Suspense fallback={<Skeleton className="mt-6 h-64" />}>
        <Signed />
      </Suspense>
    </div>
  );
}

async function Signed() {
  const { user } = await getViewer();
  if (!user) redirect("/login?next=/signed");
  const list = await mySignatures();
  if (list === null) return <p className="mt-6 text-sm text-muted">This isn&apos;t switched on yet.</p>;
  if (!list.length) {
    return (
      <div className="mt-6">
        <EmptyState icon={<BadgeCheck className="size-5" />} title="Nothing signed yet"
          body={`When you vouch for someone's work from an email sent to ${user.email ?? "your address"}, verify a milestone for your club, or sign off as a Pro, it's listed here.`} />
      </div>
    );
  }
  const people = groupByMember(list);
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">{list.length} {list.length === 1 ? "signature" : "signatures"} for {people.length} {people.length === 1 ? "person" : "people"}</p>
        <PrintButton />
      </div>
      <div className="mt-4 flex flex-col gap-5">
        {people.map((p) => (
          <section key={p.id} aria-label={p.name} className="glass-card break-inside-avoid rounded-3xl p-5">
            <h2 className="text-lg font-semibold tracking-tight"><Link href={`/u/${p.id}`} className="underline-offset-4 hover:underline">{p.name}</Link></h2>
            <ul className="mt-3 flex flex-col gap-4">
              {p.items.map((s) => (
                <li key={`${s.kind}-${s.milestone}`} className="border-t border-line pt-3 first:border-0 first:pt-0">
                  <p className="text-sm font-medium">{s.private ? <span className="inline-flex items-center gap-1.5 text-muted"><Lock className="size-3.5" />Made private by {p.first || "them"}</span> : <>{s.title}{s.project && <span className="font-normal text-muted"> · {s.project}</span>}</>}</p>
                  <p className="mt-0.5 text-xs text-muted">{signedAs(s)} · {new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}{s.status === "revoked" ? " · later revoked" : ""}</p>
                  {s.wrote && <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-text-2">&ldquo;{s.wrote}&rdquo;</blockquote>}
                  {s.how && <p className="mt-1 text-xs text-muted">How you know their work: {s.how}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
