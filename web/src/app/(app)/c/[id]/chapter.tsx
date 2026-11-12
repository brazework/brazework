import { ArrowRight, Landmark, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Celebrate } from "@/components/app/celebrate";
import { CopyLink } from "@/components/app/copy-link";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

// Chapters (Linear FIX-71): the club's national network, if it's a chapter. Loaded on its own so clubs
// work the same before supabase/chapters.sql has run.
async function networkOf(cid: string) {
  if (!(await dbFeatures()).chapters) return null;
  const { supabase } = await getViewer();
  const { data } = await supabase.from("communities").select("network_id").eq("id", cid).maybeSingle();
  const nid = (data as { network_id: string | null } | null)?.network_id;
  if (!nid) return null;
  const { data: org } = await supabase.from("organizations").select("name, slug").eq("id", nid).maybeSingle();
  return (org as { name: string; slug: string | null } | null) ?? null;
}

// "Chapter of NSBE National", under the club's name.
export async function ChapterLine({ cid }: { cid: string }) {
  const net = await networkOf(cid);
  if (!net) return null;
  const inner = <><Landmark className="size-3.5" /> Chapter of {net.name}{net.slug && <ArrowRight className="size-3" />}</>;
  const cls = "mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2";
  return net.slug ? <Link href={`/n/${net.slug}`} className={`${cls} transition hover:border-line-strong hover:text-text`}>{inner}</Link> : <span className={cls}>{inner}</span>;
}

// Right after a lead starts the chapter: the invite link, ready to paste in the group chat.
export function ChapterInvite({ cid, name, code }: { cid: string; name: string; code: string | null }) {
  const path = code && /^[0-9a-f]{16}$/.test(code) ? `/join/${code}` : null;
  const host = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <section aria-label="Invite your chapter" className="relative mt-4 overflow-hidden rounded-3xl border border-line bg-surface p-5">
      <Celebrate />
      <p className="flex items-center gap-2 text-sm font-semibold"><PartyPopper className="size-4 text-accent" /> {name} is live</p>
      <p className="mt-1 text-sm text-muted">Invite your chapter: paste this link in your group chat. Members who join through it land right here, in your chapter&apos;s feed.</p>
      {path ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs" aria-label="Invite link">{`${host}${path}`}</code>
          <CopyLink path={path} label="Copy invite link" className="justify-center" />
        </div>
      ) : (
        <Link href={`/c/${cid}/manage?tab=invite`} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-text px-4 text-sm font-medium text-surface">Make an invite link <ArrowRight className="size-4" /></Link>
      )}
      <p className="mt-3 text-xs text-faint">Next: post your first build update, and verify members&apos; milestones from <Link href={`/c/${cid}/manage?tab=report`} className="underline hover:text-text">This week</Link>.</p>
    </section>
  );
}
