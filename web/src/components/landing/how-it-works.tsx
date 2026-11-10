"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Building2, CalendarDays, Check, Heart, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";

const STEPS = [
  { title: "Your club runs on Forge", body: "Members, events, chat, announcements and roles in one place, instead of a group chat, a Google Form and a spreadsheet. Ember does the busywork." },
  { title: "Members prove the work", body: "Projects with photos, video and write-ups. Officers verify the milestones they saw happen, so every profile carries proof." },
  { title: "The right people find it", body: "Companies and alumni find people by verified work, sponsor the clubs behind it, and reach out through a respectful inbox." },
];

// Three steps on the left, a live mock of the app for the active step on the right.
// Steps advance on their own (the bar under the active step) until someone picks one.
export function HowItWorks() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center [&>*]:min-w-0">
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, n) => (
          <li key={s.title}>
            <button
              type="button"
              aria-pressed={n === step}
              onClick={() => { setAuto(false); setStep(n); }}
              className={cn(
                "relative w-full overflow-hidden rounded-3xl border p-6 text-left transition duration-300",
                n === step ? "border-line-strong bg-surface shadow-[var(--shadow)]" : "border-transparent hover:bg-surface/70",
              )}
            >
              <div className="flex items-start gap-4">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition", n === step ? "bg-accent-grad text-on-accent" : "bg-surface-2 text-muted")}>{n + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </div>
              {n === step && auto && !reduce && (
                <span key={`bar-${step}`} className="step-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent-grad" onAnimationEnd={() => setStep((v) => (v + 1) % STEPS.length)} aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="relative min-h-[420px] rounded-[2rem] border border-line bg-surface-2/60 p-4 sm:p-6" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            {step === 0 ? <ClubMock /> : step === 1 ? <ProjectMock /> : <InboxMock />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const card = "rounded-2xl border border-line bg-surface p-4 shadow-sm";
const Dot = ({ g, t }: { g: string; t: string }) => <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: g }}>{t}</span>;

function ClubMock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="h-16" style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }} />
        <div className="flex items-center gap-3 p-4">
          <span className="-mt-10 grid size-14 place-items-center rounded-2xl border-4 border-surface bg-text text-lg font-semibold text-bg">RT</span>
          <div className="min-w-0 flex-1"><div className="font-semibold">Robotics Team</div><div className="text-xs text-muted">142 members · Approval to join</div></div>
          <span className="rounded-full bg-accent-grad px-3 py-1 text-xs font-medium text-on-accent">Joined</span>
        </div>
      </div>
      <div className={card}>
        <div className="flex items-center gap-3"><Dot g="linear-gradient(135deg,#6366f1,#38bdf8)" t="PN" /><div className="text-sm"><b>Priya Nair</b> <span className="text-muted">· Captain</span></div></div>
        <p className="mt-2 text-sm text-text-2">Build night Thursday 7pm: drivetrain swap and the first autonomous run. Pizza on us.</p>
      </div>
      <div className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2"><CalendarDays className="size-5" /></span>
        <div className="flex-1 text-sm"><b>Competition prep</b><div className="text-xs text-muted">Sat 10:00 · Engineering lab</div></div>
        <span className="flex -space-x-2">{["#f59e0b", "#8b5cf6", "#10b981"].map((c) => <span key={c} className="size-6 rounded-full border-2 border-surface" style={{ background: c }} />)}</span>
        <span className="text-xs text-muted">+38</span>
      </div>
    </div>
  );
}

function ProjectMock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="relative grid h-40 place-items-center" style={{ background: "linear-gradient(135deg,#0f172a,#334155)" }}>
          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-slate-900 shadow-xl"><span className="ml-1 border-y-[9px] border-l-[14px] border-y-transparent border-l-current" /></span>
          <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 font-mono text-[11px] text-white">0:42 · autonomous run</span>
        </div>
        <div className="p-4">
          <div className="font-semibold">Autonomous rover navigation stack</div>
          <div className="mt-1 flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> 86</span><span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" /> 14</span></div>
        </div>
      </div>
      <div className={card}>
        <div className="text-xs font-medium text-faint">Milestones</div>
        <ul className="mt-3 flex flex-col gap-2.5 text-sm">
          {[["Simulation passes all 12 courses", true], ["First outdoor run", true], ["Competition run: 0.3 m path error", true]].map(([t]) => (
            <li key={t as string} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ok"><Check className="size-3" /></span><span className="flex-1">{t}</span><span className="inline-flex items-center gap-1 text-xs text-ok"><BadgeCheck className="size-3.5" /> Club verified</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InboxMock() {
  return (
    <div className="flex flex-col gap-3">
      <div className={card}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-text text-bg"><Building2 className="size-5" /></span>
          <div className="flex-1 text-sm"><div className="flex items-center gap-1 font-semibold">Autonomy team recruiter <BadgeCheck className="size-4 text-info" /></div><div className="text-xs text-muted">Verified company · in Requests</div></div>
        </div>
        <p className="mt-3 rounded-2xl rounded-tl-sm bg-surface-2 p-3 text-sm text-text-2">Hi Priya, we watched your rover&apos;s competition run. Our autonomy team would love to talk about a summer internship.</p>
        <div className="mt-3 flex gap-2"><span className="rounded-full bg-accent-grad px-3 py-1.5 text-xs font-medium text-on-accent">Accept</span><span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">Decline</span></div>
      </div>
      <div className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2"><Users className="size-5" /></span>
        <div className="flex-1 text-sm"><b>11 companies</b> follow your work<div className="text-xs text-muted">Only you can see this</div></div>
      </div>
      <div className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2"><CalendarDays className="size-5" /></span>
        <div className="flex-1 text-sm"><b>Autonomy tech talk</b><div className="text-xs text-muted">Hosted by a verified company · next to your club&apos;s events</div></div>
      </div>
    </div>
  );
}
