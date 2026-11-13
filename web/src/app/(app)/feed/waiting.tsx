import { BadgeCheck, MessageSquare, UserPlus } from "lucide-react";
import Link from "next/link";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";

// Waiting on you, on Today (redesign stage 1): the things other people are blocked on, as counts you
// can tap. Milestones to verify (officers), message requests, and connection invites. Nothing at all
// when every count is zero. Row-level security limits each count to your own rows.
export async function WaitingOnYou() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const [loop, requests, invites] = await Promise.all([
    loadLoop(supabase, user.id, requestTime()),
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "request").neq("started_by", user.id),
    supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending"),
  ]);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const items = [
    loop.toVerify && loop.toVerify.n > 0 ? { id: "verify", icon: BadgeCheck, text: `${plural(loop.toVerify.n, "milestone")} to verify`, href: `/c/${loop.toVerify.clubId}/manage?tab=verify` } : null,
    (requests.count ?? 0) > 0 ? { id: "requests", icon: MessageSquare, text: plural(requests.count ?? 0, "message request"), href: "/messages" } : null,
    (invites.count ?? 0) > 0 ? { id: "invites", icon: UserPlus, text: plural(invites.count ?? 0, "connection invite"), href: "/network" } : null,
  ].filter((x) => x !== null);
  if (!items.length) return null;
  return (
    <section aria-label="Waiting on you">
      <h2 className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">Waiting on you</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={it.href} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:border-line-strong hover:bg-hover">
              <it.icon className="size-4 text-muted" /> {it.text}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
