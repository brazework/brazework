import type { Metadata } from "next";
import { BadgeCheck, Clock, GitMerge } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { mediaUrl } from "@/lib/media";
import { proofBadge } from "@/lib/proof-card";
import { witnessCredit } from "@/lib/witness-invite";
import { loadProof } from "@/lib/proof-public";

// A proof card: one result its owner chose to share, for anyone with the link, signed in or not
// (Linear FIX-128). The preview image beside this file is what LinkedIn, X and chat apps show.
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const p = await loadProof((await params).id);
  if (!p) return { title: "Proof not found", robots: { index: false, follow: false } };
  const who = `${p.member.first} ${p.member.last}`.trim();
  return { title: `${p.title} · ${who}`, description: `${proofBadge(p)}. On ${p.project}.`, robots: { index: false, follow: false } };
}

export default function ProofPage({ params }: PageProps<"/p/[id]">) {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" prefetch={false} aria-label="Brazework home" className="self-start"><Logo /></Link>
        <Suspense fallback={<div className="mt-10 h-96 shimmer rounded-3xl" aria-busy="true" />}>
          <Proof params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Proof({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const p = await loadProof((await params).id);
  if (!p) {
    return (
      <section className="mt-16 flex flex-1 flex-col items-start">
        <h1 className="text-3xl font-semibold tracking-tight">This proof isn&apos;t shared</h1>
        <p className="mt-3 max-w-md text-muted">Its owner stopped sharing it, or the link is wrong.</p>
        <Link href="/" prefetch={false} className="mt-8 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90">See what Brazework is</Link>
      </section>
    );
  }
  const who = `${p.member.first} ${p.member.last}`.trim() || "A Brazework member";
  const signed = p.level === "signed";
  const waiting = p.level === "waiting";
  return (
    <>
      <article data-proof className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-float)]">
        {p.image && <div className="relative aspect-[16/9] w-full"><Image src={mediaUrl(p.image)} alt="" fill sizes="(max-width: 672px) 100vw, 672px" className="object-cover" /></div>}
        <div className="p-6 sm:p-8">
          <p className="text-sm text-muted">{p.project}</p>
          <h1 className="mt-2 text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">{p.title}</h1>
          {p.detail && <p className="mt-3 text-[15px] leading-relaxed text-text-2">{p.detail}</p>}
          <p className={`mt-6 inline-flex max-w-full items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${signed ? "bg-[color-mix(in_oklab,var(--ok)_13%,transparent)] text-ok" : waiting ? "bg-surface-2 text-text-2" : "bg-[color-mix(in_oklab,var(--info)_13%,transparent)] text-info"}`}>
            {signed ? <BadgeCheck className="mt-0.5 size-4 shrink-0" /> : waiting ? <Clock className="mt-0.5 size-4 shrink-0" /> : <GitMerge className="mt-0.5 size-4 shrink-0" />}
            <span>{proofBadge(p)}</span>
          </p>
          {/* Witness invitations (FIX-129): how many results the witness has signed here. */}
          {signed && witnessCredit(p.witness?.signed_count ?? 0) && <p data-witness-credit className="mt-2 text-xs text-muted">{p.witness?.vouched_by ? p.witness.vouched_by.split(",")[0] : p.witness?.name} {witnessCredit(p.witness?.signed_count ?? 0).replace(/^Has/, "has")}</p>}
          <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
            {p.member.avatar
              ? <Image src={mediaUrl(p.member.avatar)} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
              : <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-sm font-semibold">{(p.member.first[0] ?? "") + (p.member.last[0] ?? "")}</span>}
            <div className="min-w-0">
              <p className="truncate font-medium">{who}</p>
              {p.member.headline && <p className="truncate text-sm text-muted">{p.member.headline}</p>}
            </div>
            {/* Their profile, opened at this result in its project's log (FIX-240). */}
            {p.member.id && <Link href={`/u/${p.member.id}#milestone-${p.id}`} prefetch={false} className="ml-auto shrink-0 text-sm font-medium text-text-2 hover:text-text hover:underline">See it on their profile</Link>}
          </div>
        </div>
      </article>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {signed ? "Signed on Brazework by someone who saw it happen. Their name stays on it, and it can be withdrawn if it wasn't true." : waiting ? "Logged on Brazework and waiting for its signature: nobody has signed it yet. When the person who saw it signs, this page says who." : "Backed by data: GitHub confirmed this is the member's own merged work. It hasn't been signed by a person yet."}
      </p>
      <section className="mt-auto pt-12">
        <h2 className="text-xl font-semibold tracking-tight">Built something? Put it on the record.</h2>
        <p className="mt-2 text-muted">Brazework is the record of your work, signed by the people who saw it. Free for everyone who builds.</p>
        <Link href="/signup" prefetch={false} className="mt-5 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90">Start your record</Link>
      </section>
    </>
  );
}
