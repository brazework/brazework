"use client";
import { ArrowRight, Loader2, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startProject } from "@/lib/projects";

// "What are you building this semester?" (Linear FIX-71): for members with no project yet, one box
// that starts their first one. After that, every post links to it on its own.
export function FirstBuild({ first, chapter }: { first: string; chapter?: string | null }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section aria-label="Your first build" className="glass-card relative mb-4 overflow-hidden rounded-[28px] p-5 sm:p-7">
      <div aria-hidden className="cover-empty pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      <form className="relative" onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await startProject(text); if (r.ok) router.refresh(); else setError(r.message); }); }}>
        <span className="grid size-11 place-items-center rounded-2xl bg-text text-surface"><Rocket className="size-5" /></span>
        <label htmlFor="first-build" className="mt-4 block text-[1.45rem] leading-tight font-semibold tracking-tight sm:text-[1.75rem]">What are you building this semester, {first}?</label>
        <p className="mt-1.5 text-[15px] text-muted">One line is enough. {chapter ? `It's how ${chapter} sees your work, ` : "It's how your club sees your work, "}and every update you post adds to it.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input id="first-build" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} autoComplete="off"
            placeholder="A line-following robot for the regional competition"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-[16px] transition outline-none placeholder:text-faint focus:border-line-strong focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_9%,transparent)]" />
          <button type="submit" disabled={pending || text.trim().length < 3} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-text px-5 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Start my build <ArrowRight className="size-4" />
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </form>
    </section>
  );
}
