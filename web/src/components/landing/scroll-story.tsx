"use client";
import { BadgeCheck, GraduationCap, Mail, UserCheck } from "lucide-react";
import { cn } from "@/lib/forge";
import { useScrollRun } from "./use-scroll-run";

// /schools, "How it works at your school" (premium landing, 2026-11-27): the school's portal builds
// as you scroll. On a laptop the section pins and the four steps play with the scroll, the braze seam
// running down beside them (globals.css .seam-v); anywhere else, or with reduced motion, the steps are
// buttons and nothing plays by itself. Example school, people and numbers; the page says so.

export type Step = { n: string; title: string; body: string };

const FACULTY = [["Prof. Dana Ruiz", "ME 482 Robotics"], ["Prof. Alvarez", "ME 490 Capstone"], ["Prof. Iyer", "CS 485 Mobile Robotics"]];
const CLASSES = [["ME 482 Robotics", 12], ["ME 490 Formula SAE Capstone", 8], ["CS 485 Mobile Robotics", 10], ["Rocketry Club", 6]] as const;
const OUTCOMES = [["SO 1", 0.82], ["SO 2", 0.64], ["SO 3", 0.4], ["SO 4", 0.3], ["SO 5", 0.71], ["SO 6", 0.9], ["SO 7", 0.46]] as const;

export function ScrollStory({ steps }: { steps: Step[] }) {
  const { run, pinned, at, go } = useScrollRun(steps.length);

  // On a phone (or with reduced motion) nothing plays: every step is open and the portal is full.
  const shown = (k: number) => !pinned || at >= k;

  return (
    <section ref={run} aria-labelledby="how-h" data-pinned={pinned || undefined} className="story-run relative border-y border-line bg-surface-2/60">
      <div className="story-pin py-14 md:py-24">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <h2 id="how-h" className="text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance">How it works at your school</h2>
            <div className="mt-8 flex gap-5">
              <div aria-hidden="true" className="seam-v shrink-0 max-lg:hidden" data-live={pinned || undefined}><span className="seam-fill" /><span className="seam-head" /></div>
              <ol className="flex min-w-0 flex-col gap-1 max-lg:gap-6">
                {steps.map((s, k) => (
                  <li key={s.n}>
                    <button type="button" aria-pressed={pinned ? at === k : undefined} disabled={!pinned} onClick={() => go(k)} className={cn("w-full rounded-xl text-left transition disabled:cursor-default lg:px-3 lg:py-3", pinned && at === k && "bg-surface shadow-[var(--shadow-float)]", pinned && at !== k && "hover:bg-hover")}>
                      <span className={cn("block text-[17px] font-semibold tracking-tight transition-colors", !pinned || at === k ? "text-text" : at > k ? "text-text-2" : "text-faint")}>{s.title}</span>
                      <span className={cn("grid transition-[grid-template-rows,opacity] duration-500", !pinned || at === k ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                        <span className="overflow-hidden"><span className="block pt-1.5 text-[15px] leading-relaxed text-muted">{s.body}</span></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* The portal, built up one step at a time. */}
          <figure aria-label="Your school's portal, as it fills in (example)" className="hero-window rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold"><GraduationCap className="size-4 text-brand" aria-hidden="true" /> Demo University</span>
              <span className="text-xs text-faint">Example school</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile on={shown(0)} title="Students" icon={Mail}>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">{shown(0) ? "1,284" : "0"}</p>
                <p className="mt-1 text-xs text-muted">joined with an @demo.edu email</p>
              </Tile>
              <Tile on={shown(1)} title="Faculty who verify" icon={UserCheck}>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {FACULTY.map(([n, c]) => <li key={n} className="flex items-center justify-between gap-2"><span className="truncate">{n}</span><span className="truncate text-[11px] text-faint">{c}</span></li>)}
                </ul>
              </Tile>
              <Tile on={shown(2)} title="Projects by class and club" icon={GraduationCap} wide>
                <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                  {CLASSES.map(([c, n]) => <li key={c} className="flex items-center justify-between gap-2"><span className="truncate">{c}</span><span className="text-muted tabular-nums">{n} projects</span></li>)}
                </ul>
              </Tile>
              <Tile on={shown(3)} title="Verified work by ABET outcome" icon={BadgeCheck} wide>
                <div className="flex h-24 items-end gap-2">
                  {OUTCOMES.map(([o, h], i) => (
                    <span key={o} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <span className="bar-grow block w-full rounded-t-[4px] bg-[linear-gradient(180deg,var(--heat-amber),var(--brand))]" style={{ height: "100%", "--h": shown(3) ? h : 0, "--d": i } as React.CSSProperties} />
                      <span className="text-[10px] text-faint">{o}</span>
                    </span>
                  ))}
                </div>
              </Tile>
            </div>
            <figcaption className="mt-3 text-xs text-faint">Example school, people and numbers.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Tile({ on, title, icon: Icon, wide, children }: { on: boolean; title: string; icon: typeof Mail; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-3.5 transition-[opacity,transform,border-color] duration-500 motion-reduce:transition-none", wide && "sm:col-span-2", on ? "border-line bg-surface-2/50 opacity-100" : "translate-y-2 border-dashed border-line-strong opacity-40")}>
      <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-text-2"><Icon className="size-3.5" aria-hidden="true" />{title}</p>
      {children}
    </div>
  );
}
