"use client";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { BUILD_KEY, cleanBuild, firstBuildCopy } from "@/lib/front-door";
import { startProject } from "@/lib/projects";

// "What are you building this semester?" (Linear FIX-71): for members with no project yet, one box
// that starts their first one. After that, every post links to it on its own. Someone who works is
// asked what they're working on, with no semester or club in it (lib/front-door.ts firstBuildCopy).
const noStore = () => () => {};
const readBuild = () => { try { return cleanBuild(localStorage.getItem(BUILD_KEY) ?? ""); } catch { return ""; } };

export function FirstBuild({ first, chapter, student = true }: { first: string; chapter?: string | null; student?: boolean }) {
  const copy = firstBuildCopy({ first, chapter, student });
  // The line they typed on the landing page (lib/front-door.ts) is waiting here, ready to start,
  // until they type something else. Read from this browser only (nothing on the server's render).
  const waiting = useSyncExternalStore(noStore, readBuild, () => "");
  const [typed, setText] = useState<string | null>(null);
  const text = typed ?? waiting;
  const carried = typed === null && waiting !== "";
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const forget = () => { try { localStorage.removeItem(BUILD_KEY); } catch {} };
  return (
    // One clean row (2026-11-26): the question is the box's placeholder (and its label, for screen
    // readers), the button beside it, and one quiet line under it. No icon or heading.
    <section aria-label="Your first build" className="glass-card mb-4 rounded-2xl p-3 sm:p-3.5">
      <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await startProject(text); if (r.ok) { forget(); router.refresh(); } else setError(r.message); }); }}>
        <label htmlFor="first-build" className="sr-only">{copy.ask}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="first-build" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} autoComplete="off"
            placeholder={copy.ask.replace(/, [^?]+\?$/, "?")}
            className="h-12 min-w-0 shrink-0 rounded-xl border border-line bg-surface px-4 text-[16px] transition outline-none placeholder:text-muted focus:border-line-strong focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_9%,transparent)] sm:flex-1 sm:shrink" />
          <button type="submit" disabled={pending || text.trim().length < 3} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-text px-5 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Start my build <ArrowRight className="size-4" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[13px] text-muted">{carried ? "What you typed on the way in. Change it, or start as it is." : <>For example: {copy.example}. {copy.why}</>}</p>
        {error && <p role="alert" className="mt-1.5 px-1 text-sm text-danger">{error}</p>}
      </form>
    </section>
  );
}
