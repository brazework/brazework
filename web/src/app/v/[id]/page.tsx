import type { Metadata } from "next";
import { AlertTriangle, BadgeCheck, ExternalLink, GitCommit, Link2, Lock, ShieldX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { QrCode } from "@/components/qr-code";
import { Logo } from "@/components/ui";
import { env } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { loadVerify } from "@/lib/verify-load";
import { evidenceLinks, roleLabel, signerLine, stateLine, verifyDay, verifyUrl } from "@/lib/verify-public";

// A résumé verify link (supabase/verify-links.sql): one signed milestone as a recruiter checks it,
// signed in or not. What was built, the evidence, who signed it, their role and when, and whether it
// still stands. Only public milestones; a revoked one says so. Not indexed by search engines.
export async function generateMetadata({ params }: PageProps<"/v/[id]">): Promise<Metadata> {
  const v = await loadVerify((await params).id);
  if (!v) return { title: "Verification not found", robots: { index: false, follow: false } };
  const who = `${v.member.first} ${v.member.last}`.trim();
  return { title: `Verify: ${v.title} · ${who}`, description: `${stateLine(v).text}. ${signerLine(v)}.`, robots: { index: false, follow: false } };
}

export default function VerifyPage({ params }: PageProps<"/v/[id]">) {
  return (
    <main className="min-h-dvh bg-bg text-text print:bg-white">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" prefetch={false} aria-label="Brazework home"><Logo /></Link>
          <span className="text-xs font-medium tracking-wide text-faint uppercase">Verification record</span>
        </div>
        <Suspense fallback={<div className="mt-10 h-[28rem] shimmer rounded-3xl" aria-busy="true" />}>
          <Verify params={params} />
        </Suspense>
      </div>
    </main>
  );
}

const TONE = {
  ok: { cls: "bg-[color-mix(in_oklab,var(--ok)_13%,transparent)] text-ok", Icon: BadgeCheck },
  bad: { cls: "bg-[color-mix(in_oklab,var(--danger)_13%,transparent)] text-danger", Icon: ShieldX },
  warn: { cls: "bg-[color-mix(in_oklab,var(--pro)_13%,transparent)] text-pro", Icon: AlertTriangle },
};

async function Verify({ params }: { params: PageProps<"/v/[id]">["params"] }) {
  const { id } = await params;
  const v = await loadVerify(id);
  if (!v) {
    return (
      <section className="mt-16 flex flex-1 flex-col items-start">
        <h1 className="text-3xl font-semibold tracking-tight">No public record at this link</h1>
        <p className="mt-3 max-w-md text-muted">The link may be mistyped, or its owner made this work private. Brazework only shows work that someone signed, and only while its owner keeps it public.</p>
        <Link href="/" prefetch={false} className="mt-8 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90">What is Brazework?</Link>
      </section>
    );
  }
  const who = `${v.member.first} ${v.member.last}`.trim() || "A Brazework member";
  const state = stateLine(v);
  const tone = TONE[state.tone];
  const links = evidenceLinks(v);
  const images = v.evidence.filter((e): e is { type: "image"; path: string } => e.type === "image");
  const url = verifyUrl(env.siteUrl, v.id);
  const role = roleLabel(v.signer.role);

  return (
    <>
      <article data-verify={v.state} className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-float)] print:shadow-none">
        <p role="status" className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold sm:px-8 ${tone.cls}`}><tone.Icon className="size-4 shrink-0" />{state.text}</p>
        <div className="p-6 sm:p-8">
          <p className="text-sm text-muted">{who}{v.member.headline && ` · ${v.member.headline}`}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,5vw,2.4rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">{v.title}</h1>
          <p className="mt-2 text-sm text-muted">{v.project}{v.achieved_on && ` · ${verifyDay(v.achieved_on)}`}</p>
          {v.detail && <p className="mt-4 text-[15px] leading-relaxed text-text-2">{v.detail}</p>}

          <dl className="mt-6 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted">{v.signer.kind === "vouch" ? "Signed by" : "Verified by"}</dt>
            <dd className="font-medium">{signerLine(v)}</dd>
            {role && <><dt className="text-muted">Their role</dt><dd className="capitalize">{role}</dd></>}
            <dt className="text-muted">When</dt>
            <dd>{verifyDay(v.signer.at) || "Not recorded"}</dd>
            {v.pro.length > 0 && <>
              <dt className="text-muted">Also signed off by</dt>
              <dd><ul className="space-y-1">{v.pro.map((p) => <li key={`${p.name}-${p.at}`}>{p.name}{p.title && `, ${p.title}`}{p.employer && ` at ${p.employer}`} · {verifyDay(p.at)}</li>)}</ul></dd>
            </>}
            <dt className="text-muted">Status</dt>
            <dd>{v.state === "valid" ? "Valid" : v.state === "disputed" ? "Revoked, under dispute" : "Revoked"}{v.revoked_at && ` (${verifyDay(v.revoked_at)})`}</dd>
          </dl>

          {(links.length > 0 || images.length > 0 || v.kept_private > 0) && (
            <section aria-labelledby="ev-h" className="mt-6 border-t border-line pt-6">
              <h2 id="ev-h" className="text-sm font-semibold">Evidence</h2>
              {links.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {links.map((e) => (
                    <li key={e.url} className="flex min-w-0 items-center gap-2 text-sm">
                      {e.type === "commit" ? <GitCommit className="size-4 shrink-0 text-muted" /> : <Link2 className="size-4 shrink-0 text-muted" />}
                      <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate underline-offset-4 hover:underline">{e.label}</a>
                      {e.after_signing && <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">added after signing{e.added_at ? `, ${verifyDay(e.added_at)}` : ""}</span>}
                      <ExternalLink className="size-3 shrink-0 text-faint print:hidden" />
                    </li>
                  ))}
                </ul>
              )}
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((im) => <div key={im.path} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2"><Image src={mediaUrl(im.path)} alt="Evidence photo" fill sizes="200px" className="object-cover" /></div>)}
                </div>
              )}
              {v.kept_private > 0 && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3" />{v.kept_private} more {v.kept_private === 1 ? "item" : "items"} (files, videos or club events) seen by the signer, not shown publicly.</p>}
            </section>
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-4 border-t border-line bg-surface-2/50 px-6 py-4 sm:px-8">
          <div className="rounded-lg bg-white p-1"><QrCode value={url} size={88} label="QR code for this verification page" /></div>
          <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            <p className="truncate font-medium text-text-2">{url.replace(/^https?:\/\//, "")}</p>
            <p>Checked live on {verifyDay(v.checked_at)}. If the signature is withdrawn, this page says so.</p>
          </div>
        </footer>
      </article>
      <p className="mt-4 text-sm leading-relaxed text-muted print:hidden">
        Brazework is the record of what people build, signed by the people who saw it. A club officer verifies work from their club; a professor, manager or mentor signs from their university or work email, and the signature says when the company isn&apos;t verified here. The member can&apos;t sign their own work or edit it after it&apos;s signed.
      </p>
      <section className="mt-auto pt-12 print:hidden">
        <Link href="/signup" prefetch={false} className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-[15px] font-medium hover:bg-hover">Start your own record</Link>
      </section>
    </>
  );
}
