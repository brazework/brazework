"use client";
import { ArrowRight, Link2, PenLine, Plus } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/app/verified-seal";
import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";
import { useScrollRun } from "./use-scroll-run";

// How it works: the same three steps for a student, a professional and a club member. Torch, the AI
// built in, does the busywork, and nothing is saved or signed until a person says yes.
// Premium pass (2026-11-27): on a laptop it pins and plays as you scroll (use-scroll-run.ts), beside
// an exploded view of four pieces of work, from a class, a club, a job and a client: they sit in one
// stack as they're logged, come apart to be signed, and close under the record they become
// (globals.css .xv-*). Anywhere else it's the three steps, one under the other, with nothing hidden.
const STEPS = [
  { icon: Plus, title: "Log what you built", body: "A class project, a club build or something you shipped at work. Add a photo, a file or a link. Or tell Torch in one sentence and it writes it up.", sample: <span className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-text-2">Cut the robot arm&apos;s cycle from 9.4 to 7.1 seconds</span> },
  { icon: PenLine, title: "Someone who saw it signs it", body: "Your professor, a club officer, your coworker or a client signs it with their name. They get one email and don't need an account.", sample: <span className="flex flex-wrap gap-1.5">{["Your professor", "Your club", "Your coworker", "A client"].map((x) => <span key={x} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-text-2">{x}</span>)}</span> },
  { icon: Link2, title: "It's yours for good", body: "Each signed piece goes on your record, with one link for LinkedIn, your résumé or any application. Change schools or jobs, and it comes with you.", sample: <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-text-2"><Seal size={16} /> Verified by Prof. Dana Ruiz</span> },
];

// Example work and people, one from each place work happens.
const PIECES = [
  { what: "Cut the robot arm's cycle from 9.4 to 7.1 seconds", by: "Prof. Dana Ruiz, ME 482" },
  { what: "Held a hover within 0.3 m in 15 km/h wind", by: "A. Novak, Aerial Robotics Club" },
  { what: "Cut CI from 22 to 9 minutes", by: "R. Okoro, Staff Engineer, Northwind Aero" },
  { what: "Shipped the checkout redesign", by: "J. Park, client" },
];

export function How() {
  const { run, pinned, at, go } = useScrollRun(STEPS.length);
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20">
      <div ref={run as React.RefObject<HTMLDivElement>} data-pinned={pinned || undefined} data-step={at} className="story-run xv-run">
        <div className="story-pin py-20 md:py-24">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
            <div>
              <h2 id="how-h" className={H2}>How it works</h2>
              <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-muted">Three steps, the same whether you&apos;re in school, at work or in a club. Anyone can write a great résumé now. A name standing behind your work is much harder to fake.</p>
              <div className="mt-10 flex gap-5">
                <div aria-hidden="true" className="seam-v shrink-0 max-lg:hidden" data-live={pinned || undefined}><span className="seam-fill" /><span className="seam-head" /></div>
                <ol className="flex min-w-0 flex-1 flex-col gap-2 max-lg:gap-8">
                  {STEPS.map((s, k) => {
                    const open = !pinned || at === k;
                    return (
                      <li key={s.title} className={cn("rounded-2xl transition duration-300 lg:px-4 lg:py-3.5", pinned && at === k && "bg-surface shadow-[var(--shadow-float)]")}>
                        <h3><Step pinned={pinned} pressed={at === k} onClick={() => go(k)} className="flex w-full items-center gap-3 text-left">
                          <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold transition-colors", !pinned || at >= k ? "bg-accent text-on-accent" : "border border-line-strong text-faint")}>{k + 1}</span>
                          <span className={cn("text-lg font-semibold tracking-tight transition-colors", !pinned || at === k ? "text-text" : at > k ? "text-text-2" : "text-faint")}>{s.title}</span>
                        </Step></h3>
                        <div className={cn("grid transition-[grid-template-rows,opacity] duration-500", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                          <div className="overflow-hidden">
                            <p className="pt-2.5 pl-10 text-[15px] leading-relaxed text-muted">{s.body}</p>
                            <div aria-hidden="true" className="flex pt-4 pl-10">{s.sample}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* The exploded view (laptop): four signed pieces and the record they close into. */}
            <figure aria-hidden="true" className="xv-stage relative mx-auto hidden h-[26rem] w-full max-w-[34rem] lg:block">
              <div className="xv-assembly absolute top-1/2 left-1/2">
                {PIECES.map((c, i) => (
                  <div key={c.what} className="xv-card" style={{ "--i": i } as React.CSSProperties}>
                    <p className="text-[14px] leading-snug font-semibold">{c.what}</p>
                    <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted">
                      <span className="xv-seal inline-flex"><Seal size={14} /></span>
                      <span className="truncate">Signed by {c.by}</span>
                    </p>
                  </div>
                ))}
                <div className="xv-card xv-cover" style={{ "--i": PIECES.length } as React.CSSProperties}>
                  <p className="text-[12px] text-muted">Maya Chen&apos;s record</p>
                  <p className="mt-1 text-[16px] font-semibold tracking-tight">4 pieces of work, each signed</p>
                  <p className="mt-2 font-mono text-[12px] text-brand">brazework.com/v/8f2k4q</p>
                </div>
              </div>
              <figcaption className="absolute right-0 bottom-0 text-xs text-faint">Example work and people</figcaption>
            </figure>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 md:pb-24">
        <div className="reveal flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center md:p-6">
          <Ember mood="happy" size={44} label="Torch" />
          <p className="flex-1 text-[15px] leading-relaxed text-muted"><span className="font-semibold text-text">Torch, your AI teammate, does the busywork.</span> It writes up what you did, finds who should sign it, plans your week and can start a club or study group for you. It never signs anything, and nothing is saved until you say yes.</p>
          <Link href="/ai" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline">Use it from Claude or ChatGPT <ArrowRight className="size-3.5" /></Link>
        </div>
      </div>
    </section>
  );
}

// A step's title is a button only while the section plays (it scrolls there); otherwise it's text.
function Step({ pinned, pressed, onClick, className, children }: { pinned: boolean; pressed: boolean; onClick: () => void; className: string; children: React.ReactNode }) {
  return pinned
    ? <button type="button" aria-pressed={pressed} onClick={onClick} className={className}>{children}</button>
    : <span className={className}>{children}</span>;
}
