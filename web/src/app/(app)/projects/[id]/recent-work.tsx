"use client";
import { GitMerge, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Panel } from "@/components/app/page-ui";
import { addRecentWork } from "@/lib/recent-work";
import { ADD_MAX, workKey, type RecentWork as Work } from "@/lib/recent-work-pick";

// "From GitHub: your last 90 days" (lib/recent-work-pick.ts), for the project's owner once a repo is
// linked: their own merged pull requests that aren't on their record yet, ready to add in one tap.
// Each is checked with GitHub on the server before it's saved, and shows who approved it there
// (supabase/approved-by.sql). Nobody is asked to sign anything. The first ten are ticked to start.
export function RecentWork({ projectId, items }: { projectId: string; items: Work[] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.slice(0, ADD_MAX).map((w) => workKey(w.repo, w.ref))));
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!items.length) return null;
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else if (n.size < ADD_MAX) n.add(k); return n; });
  const full = picked.size >= ADD_MAX;
  const add = () => start(async () => {
    const r = await addRecentWork(projectId, items.filter((w) => picked.has(workKey(w.repo, w.ref))).map((w) => ({ repo: w.repo, ref: w.ref })));
    setDone({ ok: r.ok, message: r.message });
    if (r.ok) { setPicked(new Set()); router.refresh(); }
  });
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <Panel className="p-6">
      <section aria-labelledby="recent-work-h">
        <h2 id="recent-work-h" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><GitMerge className="size-5 text-info" /> From GitHub: your last 90 days</h2>
        <p className="mt-1 text-sm text-muted">
          You merged {items.length} pull {items.length === 1 ? "request" : "requests"} that {items.length === 1 ? "isn't" : "aren't"} on your record yet. Add them and each is checked with GitHub and shows who approved it. Nobody is asked to sign.
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Pull requests you merged">
          {items.map((w) => {
            const k = workKey(w.repo, w.ref);
            const on = picked.has(k);
            return (
              <li key={k}>
                <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 transition hover:bg-hover has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
                  <input type="checkbox" checked={on} disabled={pending || (!on && full)} onChange={() => toggle(k)} className="mt-1 size-4 shrink-0 accent-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{w.title}</span>
                    <span className="block truncate text-xs text-muted">PR #{w.ref} in {w.repo} · merged {day(w.mergedOn)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} disabled={pending || picked.size === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-text px-4 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40">
            {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Checking with GitHub" : `Add ${picked.size || ""} to my record`.replace("  ", " ")}
          </button>
          <span className="text-xs text-muted">{items.length > ADD_MAX ? `Up to ${ADD_MAX} at a time. ` : ""}Work from a private repo is added hidden; you choose when to show it.</span>
        </div>
        {done && <p role={done.ok ? "status" : "alert"} className={`mt-3 text-sm ${done.ok ? "text-ok" : "text-danger"}`}>{done.message}</p>}
      </section>
    </Panel>
  );
}
