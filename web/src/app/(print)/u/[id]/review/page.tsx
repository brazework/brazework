import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { dbFeatures } from "@/lib/db-features";
import { accessLabel, canUse } from "@/lib/plans";
import { fmtDay, packetLinks, packetRange, packetSigner, packetSummary, type PacketItem } from "@/lib/review-packet";
import { getViewer } from "@/lib/supabase/server";
import { PrintButton } from "../resume/print-button";

export const metadata: Metadata = { title: "Review packet", robots: { index: false, follow: false } };

// The review packet (lib/review-packet.ts): your signed milestones over a date range, with who signed
// each, their role, when and what they wrote, and the evidence. For a performance review; "Save as PDF"
// is the browser's print dialog. Only your own, only signed work. Private work is left out unless you
// tick "Include private work" (it's your printout). Gated by FEATURE_ACCESS.reviewPacket (lib/plans.ts).
export default function ReviewPacketPage({ params, searchParams }: PageProps<"/u/[id]/review">) {
  return (
    <div className="min-h-dvh bg-zinc-100 py-8 print:bg-white print:py-0">
      <Suspense fallback={<div className="mx-auto h-[1000px] max-w-[816px] animate-pulse bg-white" />}>
        <Packet params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Packet({ params, searchParams }: { params: PageProps<"/u/[id]/review">["params"]; searchParams: PageProps<"/u/[id]/review">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getViewer();
  if (!user) redirect(`/login?next=/u/${id}/review`);
  if (user.id !== id) notFound(); // only your own
  if (!canUse("reviewPacket", user)) {
    return (
      <article className="mx-auto max-w-[640px] bg-white px-10 py-12 text-zinc-800 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Plus</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Review packets come with Plus</h1>
        <p className="mt-3 text-sm leading-relaxed">A printable record of your signed work over any period, with who signed each piece and what they wrote, for a performance review. Plus is coming soon.</p>
        <a href={`/u/${id}`} className="mt-6 inline-block rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200">Back to profile</a>
      </article>
    );
  }
  const range = packetRange(one(sp.from), one(sp.to), new Date());
  const withPrivate = one(sp.private) === "1";
  const f = await dbFeatures();
  const cols = `id, project_id, title, detail, achieved_on, community_name, reviewer_name, reviewer_role, reviewed_at, review_note, evidence, evidence_items, private${f.vouches ? ", vouched_by" : ""}`;
  let q = supabase.from("milestones").select(cols).eq("owner_id", id).eq("status", "verified").gte("achieved_on", range.from).lte("achieved_on", range.to).order("achieved_on", { ascending: false }).limit(200);
  if (!withPrivate) q = q.eq("private", false);
  const [{ data: ms }, { data: me }, { data: projects }] = await Promise.all([
    q,
    supabase.from("profiles").select("first_name, last_name, headline").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, title, private").eq("owner_id", id).limit(200),
  ]);
  const proj = new Map(((projects ?? []) as { id: string; title: string; private: boolean }[]).map((p) => [p.id, p]));
  const rows = ((ms ?? []) as unknown as Omit<PacketItem, "project" | "pro">[])
    .filter((m) => withPrivate || !proj.get(m.project_id)?.private)
    .map((m) => ({ ...m, vouched_by: m.vouched_by ?? "", project: proj.get(m.project_id)?.title ?? "", pro: [] as PacketItem["pro"] }));
  const { data: pros } = rows.length && f.proVerification
    ? await supabase.from("pro_reviews").select("milestone_id, reviewer_name, reviewer_title, employer_name, note, created_at").in("milestone_id", rows.map((r) => r.id))
    : { data: [] };
  for (const r of (pros ?? []) as (PacketItem["pro"][number] & { milestone_id: string })[]) rows.find((x) => x.id === r.milestone_id)?.pro.push(r);
  const name = `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim();
  const label = accessLabel("reviewPacket");

  return (
    <>
      <form method="get" className="mx-auto mb-4 flex max-w-[816px] flex-wrap items-end justify-between gap-3 px-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3 text-sm text-zinc-700">
          <label className="flex flex-col gap-1">From<input type="date" name="from" defaultValue={range.from} className="h-9 rounded-lg border border-zinc-300 bg-white px-2" /></label>
          <label className="flex flex-col gap-1">To<input type="date" name="to" defaultValue={range.to} className="h-9 rounded-lg border border-zinc-300 bg-white px-2" /></label>
          <label className="flex h-9 items-center gap-2"><input type="checkbox" name="private" value="1" defaultChecked={withPrivate} />Include private work</label>
          <button className="h-9 rounded-lg border border-zinc-300 bg-white px-3 font-medium hover:bg-zinc-50">Update</button>
        </div>
        <div className="flex gap-2">
          <a href={`/u/${id}`} className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200">Back to profile</a>
          <PrintButton />
        </div>
        {label && <p className="w-full text-xs text-zinc-500">{label}</p>}
      </form>
      <article className="mx-auto max-w-[816px] bg-white px-14 py-12 text-[13px] leading-relaxed text-zinc-800 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="border-b border-zinc-300 pb-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Review packet · signed work</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{name || "Your work"}</h1>
          {me?.headline && <p className="text-zinc-600">{me.headline}</p>}
          <p className="mt-2 text-zinc-600">{fmtDay(range.from)} to {fmtDay(range.to)} · <span data-summary>{packetSummary(rows)}</span></p>
        </header>
        {rows.length === 0 ? (
          <p className="mt-6 text-zinc-600">Nothing signed in this period. Pick other dates above, or ask the people who saw your work to sign it.</p>
        ) : (
          <ol className="mt-2">
            {rows.map((m) => (
              <li key={m.id} aria-label={m.title} className="break-inside-avoid border-b border-zinc-200 py-4 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h2 className="text-[15px] font-semibold text-zinc-900">{m.title}</h2>
                  <span className="text-zinc-500">{fmtDay(m.achieved_on)}</span>
                </div>
                <p className="text-zinc-500">{m.project}{m.private && " · private"}</p>
                {m.detail && <p className="mt-1">{m.detail}</p>}
                <p className="mt-2"><span className="font-medium text-zinc-900">{m.vouched_by ? "Signed by" : "Verified by"} {packetSigner(m)}</span>{m.reviewed_at && <span className="text-zinc-500"> on {fmtDay(m.reviewed_at)}</span>}</p>
                {m.review_note && <blockquote className="mt-1 border-l-2 border-zinc-300 pl-3 text-zinc-700">&ldquo;{m.review_note}&rdquo;</blockquote>}
                {m.pro.map((r) => <p key={r.reviewer_name + r.created_at} className="mt-2"><span className="font-medium text-zinc-900">Signed off by {r.reviewer_name}{r.reviewer_title && `, ${r.reviewer_title}`}{r.employer_name && ` at ${r.employer_name}`}</span> <span className="text-zinc-500">on {fmtDay(r.created_at)}</span>: &ldquo;{r.note}&rdquo;</p>)}
                {packetLinks(m).length > 0 && <p className="mt-1 break-all text-zinc-500">Evidence: {packetLinks(m).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        )}
        <footer className="mt-8 border-t border-zinc-300 pt-3 text-[11px] text-zinc-500">
          From Brazework on {fmtDay(new Date().toISOString())}. Each item was signed by the person named, from their club role or their university or company email; the member can&apos;t sign or edit their own.
        </footer>
      </article>
    </>
  );
}
