"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, GraduationCap, Megaphone, Search, Sparkles, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";

// The hero: one clear line, then the four groups Brazework serves. Each one shows what Brazework does for
// them in a small live preview (example data, labelled as such). It cycles until you pick one.
const AUDIENCES = [
  {
    id: "students", label: "Students", short: "Students", icon: GraduationCap, cta: { label: "Create your profile", href: "/signup" },
    line: "Post what you're building, get it verified by your club, and carry that proof into every application.",
  },
  {
    id: "orgs", label: "Clubs", short: "Clubs", icon: Users, cta: { label: "Bring your club", href: "#founding" },
    line: "Run your chapter in one place. Ember handles the busywork, and every milestone you verify follows your members into their careers.",
  },
  {
    id: "companies", label: "Companies", short: "Companies", icon: Building2, cta: { label: "Sponsor a challenge", href: "#founding" },
    line: "Find people by verified work, not keywords. Sponsor a build challenge and meet the members who win it.",
  },
  {
    id: "pros", label: "Professionals", short: "Professionals", icon: UserRound, cta: { label: "Join free", href: "/signup" },
    line: "Show work that's been vouched for, mentor the chapters in your field, and get found for what you've actually built.",
  },
] as const;
type Id = (typeof AUDIENCES)[number]["id"];

export function Hero() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduce = useReducedMotion();
  const a = AUDIENCES[i];

  useEffect(() => {
    if (!auto || reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % AUDIENCES.length), 5200);
    return () => clearInterval(t);
  }, [auto, reduce]);

  return (
    <section id="top" data-story="Brazework" className="story-sec relative isolate overflow-hidden pt-32 pb-20 sm:pt-40">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="bg-accent-grad absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
        <div>
          <a href="#founding" className="rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-text-2 shadow-sm transition hover:border-line-strong">
            <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" /><span className="relative size-2 rounded-full bg-ok" /></span>
            <span className="truncate">Founding clubs program is open</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </a>
          <h1 className="focus-in mt-7 text-[clamp(2.7rem,6.2vw,5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
            <span className="text-grad">Verified work,</span>
            <br />
            not résumés.
          </h1>
          <p className="m-hide focus-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ ["--delay" as string]: "0.1s" }}>
            Your club&apos;s officers saw you build it. On Brazework they vouch for it, and companies hire on that proof, not on a résumé anyone can write. Clubs run on it, and Ember, the built-in AI agent, does the busywork.
          </p>
          {/* Phones: the same idea, short enough to read in full. */}
          <p className="m-only focus-in mt-5 text-base leading-relaxed text-muted">Your club vouches for what you build. Companies hire on that proof, not a résumé.</p>

          <div className="rise-in mt-8" style={{ ["--delay" as string]: "0.2s" }}>
            <div role="tablist" aria-label="Who Brazework is for" className="flex flex-wrap gap-2">
              {AUDIENCES.map((x, n) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={n === i}
                  aria-controls="hero-preview"
                  onClick={() => { setAuto(false); setI(n); }}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-3.5 py-1.5 text-sm transition",
                    n === i ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                  )}
                >
                  <x.icon className="size-4" /> <span className="hidden sm:inline">{x.label}</span><span className="sm:hidden">{x.short}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-4 min-h-[3.25rem] max-w-xl text-[15px] leading-relaxed text-text-2" aria-live="polite">
                {a.line}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="rise-in mt-7 flex flex-wrap items-center gap-3" style={{ ["--delay" as string]: "0.3s" }}>
            <Button href={a.cta.href} size="lg">{a.cta.label} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Button>
            {a.cta.href !== "/signup" && <Button href="/signup" variant="outline" size="lg">Join free</Button>}
          </div>
          <p className="rise-in mt-4 text-sm text-faint" style={{ ["--delay" as string]: "0.35s" }}>Free for students and clubs · Verified university and work emails</p>
        </div>

        <div id="hero-preview" role="tabpanel" className="relative mx-auto w-full max-w-[440px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={a.id} initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.98 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <Preview id={a.id} />
            </motion.div>
          </AnimatePresence>
          <p className="mt-3 text-center text-xs text-faint">Example data</p>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-3xl p-5 shadow-[var(--shadow)]">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted"><Icon className="size-4" /> {title}</div>
      {children}
    </div>
  );
}

function Row({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.35 }} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm">
      {children}
    </motion.div>
  );
}

const Dot = ({ className }: { className?: string }) => <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", className)} />;

function Preview({ id }: { id: Id }) {
  if (id === "students") return <StudentPreview />;
  if (id === "orgs") {
    return (
      <Panel title="Ember · this week for your chapter" icon={Sparkles}>
        <div className="space-y-2">
          <Row><CalendarDays className="size-4 shrink-0 text-text-2" /><span className="flex-1">General body meeting created · Thu 6:00 PM</span><BadgeCheck className="size-4 text-ok" /></Row>
          <Row delay={0.12}><Megaphone className="size-4 shrink-0 text-text-2" /><span className="flex-1">Weekly update drafted from real numbers</span><span className="text-xs text-faint">Review</span></Row>
          <Row delay={0.24}><BadgeCheck className="size-4 shrink-0 text-text-2" /><span className="flex-1">3 member milestones ready to verify</span><span className="text-xs text-faint">Open</span></Row>
          <Row delay={0.36}><Users className="size-4 shrink-0 text-text-2" /><span className="flex-1">12 new members this month</span><span className="text-xs font-medium text-ok">+40%</span></Row>
        </div>
        <p className="mt-4 text-xs text-faint">Ember drafts; officers approve every action.</p>
      </Panel>
    );
  }
  if (id === "pros") {
    return (
      <Panel title="A profile built from proof" icon={UserRound}>
        <div className="flex items-center gap-3">
          <span className="bg-accent-grad grid size-12 place-items-center rounded-full text-sm font-semibold text-on-accent">AO</span>
          <div><div className="font-semibold">Amara Osei</div><div className="text-xs text-muted">Battery systems engineer · Open to mentoring</div></div>
        </div>
        <div className="mt-4 space-y-2">
          <Row><BadgeCheck className="size-4 shrink-0 text-ok" /><span className="flex-1">Pack thermal model, validated on test rig</span><span className="text-xs text-faint">Verified</span></Row>
          <Row delay={0.12}><BadgeCheck className="size-4 shrink-0 text-ok" /><span className="flex-1">Judged regional design competition</span><span className="text-xs text-faint">Verified</span></Row>
          <Row delay={0.24}><Users className="size-4 shrink-0 text-text-2" /><span className="flex-1">Mentoring 2 student chapters</span></Row>
        </div>
      </Panel>
    );
  }
  if (id === "companies") {
    return (
      <Panel title="Find people by verified work" icon={Search}>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-muted"><Search className="size-4" /> embedded systems · verified · graduating 2027</div>
        <div className="mt-3 space-y-2">
          {[["Jordan Reyes", "Flight computer logging at 200 Hz", "Verified by Rocketry Club"], ["Priya Nair", "Low-power sensor mesh", "Verified by IEEE branch"], ["Malik Brooks", "Motor controller, 3 revisions", "Verified by Robotics team"]].map(([n, w, v], k) => (
            <Row key={n} delay={k * 0.12}>
              <Dot className="bg-surface-2" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{n}</span><span className="block truncate text-xs text-muted">{w}</span></span>
              <span className="hidden shrink-0 items-center gap-1 text-xs text-ok sm:inline-flex"><BadgeCheck className="size-3.5" />{v.split(" by ")[0]}</span>
            </Row>
          ))}
        </div>
      </Panel>
    );
  }
  return null;
}

function StudentPreview() {
  return (
    <Panel title="A profile built from proof" icon={GraduationCap}>
      <div className="flex items-center gap-3">
        <span className="bg-accent-grad grid size-12 place-items-center rounded-full text-sm font-semibold text-on-accent">JR</span>
        <div><div className="font-semibold">Jordan Reyes</div><div className="text-xs text-muted">Aerospace engineering · Class of 2027</div></div>
      </div>
      <div className="mt-4 space-y-2">
        <Row><BadgeCheck className="size-4 shrink-0 text-ok" /><span className="flex-1">Flight computer logs at 200 Hz</span><span className="text-xs text-faint">Verified</span></Row>
        <Row delay={0.12}><BadgeCheck className="size-4 shrink-0 text-ok" /><span className="flex-1">Static fire passed, L2 motor</span><span className="text-xs text-faint">Verified</span></Row>
        <Row delay={0.24}><Users className="size-4 shrink-0 text-text-2" /><span className="flex-1">Rocketry Club · Avionics lead</span></Row>
      </div>
      <p className="mt-4 text-xs text-faint">Each badge names the club officer who verified it.</p>
    </Panel>
  );
}
