"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import { BadgeCheck, CalendarDays, Inbox, LineChart, ShieldCheck, Users } from "lucide-react";
import { useRef } from "react";
import { Kicker } from "@/components/ui";
import { cn } from "@/lib/forge";
import { Reveal } from "./reveal";

function Card({ className, children, delay = 0 }: { className?: string; children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn("group relative overflow-hidden rounded-3xl border border-line bg-surface/70 p-7", className)}>
      <div className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-500 group-hover:opacity-100 [background:radial-gradient(500px_circle_at_50%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_60%)]" />
      {children}
    </Reveal>
  );
}

function BuildLog() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const steps = [
    ["Wk 1", "Requirements + CAD v0", "done"],
    ["Wk 3", "Prototype printed, 2 critiques", "done"],
    ["Wk 5", "Load test: 38 kg at 2 mm sag", "done"],
    ["Wk 6", "Club demo day: attested", "live"],
  ];
  return (
    <div className="relative mt-6">
      <motion.span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-[7px] w-px origin-top bg-gradient-to-b from-accent via-accent/50 to-transparent"
        initial={{ scaleY: 0 }}
        animate={inView ? { scaleY: 1 } : {}}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
    <ol ref={ref} className="relative space-y-4 pl-6">
      {steps.map(([wk, label, state], i) => (
        <motion.li
          key={wk}
          className="relative"
          initial={{ opacity: 0, x: -10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.25 + i * 0.22 }}
        >
          <span className={cn("absolute top-1.5 -left-6 size-3.5 rounded-full border-2", state === "live" ? "border-accent bg-accent shadow-[0_0_16px_var(--accent)]" : "border-accent/60 bg-bg")} />
          <span className="font-mono text-[11px] text-faint">{wk}</span>
          <div className="text-sm text-text-2">{label}</div>
        </motion.li>
      ))}
    </ol>
    </div>
  );
}

function Sparkline() {
  const reduce = useReducedMotion();
  const d = "M0 52 C 30 50, 40 40, 70 42 S 120 20, 150 26 S 210 8, 260 12";
  return (
    <svg viewBox="0 0 260 60" className="mt-6 h-20 w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L260 60 L0 60 Z`} fill="url(#spark-fill)" />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
    </svg>
  );
}

function EventTicket() {
  return (
    <div className="mt-6 flex items-stretch overflow-hidden rounded-2xl border border-line bg-surface-2/80">
      <div className="flex w-16 flex-col items-center justify-center border-r border-dashed border-line-strong bg-accent/10 py-3">
        <span className="font-mono text-[10px] tracking-widest text-accent uppercase">Mar</span>
        <span className="text-2xl leading-none font-semibold">14</span>
      </div>
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="truncate text-sm font-medium">Robotics Demo Day</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
          <BadgeCheck className="size-3 text-accent" /> Hosted by a verified org
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {["#ff7a2f", "#ffb547", "#ff4d1a"].map((c) => (
              <span key={c} className="size-5 rounded-full border-2 border-surface-2" style={{ background: c }} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted">42 going</span>
          <span className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-on-accent">RSVP</span>
        </div>
      </div>
    </div>
  );
}

function RequestRow() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface-2/80 p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-raised font-mono text-[10px] text-muted">JR</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            Message request <span className="rounded bg-raised px-1.5 font-mono text-[9px] text-faint uppercase">Not connected</span>
          </div>
          <div className="truncate text-xs text-faint">Loved your load-test writeup. Open to chat?</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <span className="rounded-lg bg-accent/15 py-1 font-medium text-accent">Accept</span>
        <span className="rounded-lg bg-raised py-1 text-muted">Decline</span>
        <span className="rounded-lg bg-raised py-1 text-danger">Block</span>
      </div>
    </div>
  );
}

export function Bento() {
  return (
    <section id="product" className="relative mx-auto max-w-7xl scroll-mt-24 px-6 py-24 sm:py-32">
      <Reveal className="max-w-3xl">
        <Kicker>The product</Kicker>
        <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
          A résumé tells people what you did.{" "}
          <span className="font-display font-normal italic text-molten">Forge shows them.</span>
        </h2>
        <p className="mt-5 text-lg text-muted">Everything a STEM club needs to run, and everything a member needs to get noticed, in one place that remembers the work.</p>
      </Reveal>

      <div className="mt-16 grid auto-rows-[minmax(240px,auto)] gap-4 md:grid-cols-6">
        <Card className="md:col-span-3 md:row-span-2">
          <Kicker>01 / Build logs</Kicker>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">Work that proves itself</h3>
          <p className="mt-2 max-w-md text-muted">Post projects with CAD, schematics, code and test data. Keep a build log as you go. When your club or lab attests a milestone, it&apos;s on your profile for good.</p>
          <BuildLog />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            whileInView={{ opacity: 1, scale: 1, rotate: -2 }}
            viewport={{ once: true }}
            transition={{ delay: 1.3, type: "spring", stiffness: 260, damping: 16 }}
            className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3"
          >
            <ShieldCheck className="size-6 text-accent" />
            <div>
              <div className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Attested milestone</div>
              <div className="text-sm text-text">Verified by the club that saw it happen</div>
            </div>
          </motion.div>
        </Card>

        <Card className="md:col-span-3" delay={0.05}>
          <div className="flex items-start justify-between">
            <div>
              <Kicker>02 / Clubs</Kicker>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">Your club&apos;s operating system</h3>
            </div>
            <Users className="size-6 text-accent" />
          </div>
          <p className="mt-2 text-muted">Roles from owner to helper, join requests, moderation and a feed that stays on topic. Retire the Discord server and the Google Form.</p>
          <div className="mt-5 flex -space-x-2">
            {["#ff7a2f", "#ffb547", "#ff4d1a", "#f59e0b", "#fb923c", "#fdba74"].map((c, i) => (
              <motion.span
                key={c}
                className="size-9 rounded-full border-2 border-surface"
                style={{ background: `linear-gradient(135deg, ${c}, #7c2d12)` }}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
              />
            ))}
            <span className="grid size-9 place-items-center rounded-full border-2 border-surface bg-raised font-mono text-[10px] text-muted">+48</span>
          </div>
        </Card>

        <Card className="md:col-span-3" delay={0.1}>
          <div className="flex items-start justify-between">
            <div>
              <Kicker>03 / Verified</Kicker>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">Know who you&apos;re talking to</h3>
            </div>
            <ShieldCheck className="size-6 text-accent" />
          </div>
          <p className="mt-2 text-muted">Students verify with a university email. Companies and schools verify with their own domain. No anonymous recruiters, no fake candidates.</p>
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
            {["you@state.edu", "lab@uni.ac.uk", "eng@yourco.com"].map((e) => (
              <span key={e} className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-line bg-surface-2 px-3 py-1.5 text-text-2">
                <BadgeCheck className="size-3.5 text-accent" /> {e}
                <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,var(--accent)_18%,transparent)_50%,transparent_70%)] bg-[length:200%_100%]" />
              </span>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-2" delay={0.05}>
          <CalendarDays className="size-6 text-accent" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight">Events that turn into opportunities</h3>
          <p className="mt-2 text-sm text-muted">Demo days, tech talks and career nights from verified organizations. RSVP, save, add to calendar.</p>
          <EventTicket />
        </Card>
        <Card className="md:col-span-2" delay={0.1}>
          <Inbox className="size-6 text-accent" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight">An inbox that respects you</h3>
          <p className="mt-2 text-sm text-muted">Strangers land in a request inbox. Accept, decline or block and report. You choose who can reach you.</p>
          <RequestRow />
        </Card>
        <Card className="md:col-span-2" delay={0.15}>
          <LineChart className="size-6 text-accent" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight">See who&apos;s noticing</h3>
          <p className="mt-2 text-sm text-muted">Private analytics on profile views and engagement. Only you see them.</p>
          <Sparkline />
        </Card>
      </div>
    </section>
  );
}
