"use client";
import { AnimatePresence, motion } from "motion/react";
import { Building2, GraduationCap, Loader2, PartyPopper, Wrench } from "lucide-react";
import { useActionState, useState } from "react";
import { registerOrgInterest, type OrgInterestState } from "@/app/actions/org-interest";
import { Button, Field, Kicker, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { Reveal } from "./reveal";
import { submitWithoutReset } from "@/lib/submit";

const TYPES = [
  { id: "club", label: "Club", icon: Wrench, title: "For clubs", body: "Robotics, rocketry, ACM, IEEE, SWE, NSBE, SHPE and every team that builds. Run your club on Forge, and your members' work follows them into their careers." },
  { id: "company", label: "Company", icon: Building2, title: "For companies", body: "Meet engineers and scientists through what they've built and what their club vouched for. Sponsor club projects, host events, skip the résumé pile." },
  { id: "school", label: "School", icon: GraduationCap, title: "For schools", body: "Give students a verified home for their work. Highlight student projects, share career events and connect them with employers and alumni." },
] as const;

export function Organizations() {
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("club");
  const [state, action, pending] = useActionState<OrgInterestState, FormData>(registerOrgInterest, { ok: false, message: "" });

  return (
    <section id="organizations" className="relative scroll-mt-24 border-t border-line bg-surface/30 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <Kicker>For organizations</Kicker>
            <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
              Clubs, companies and schools <span className="text-shine">have a home here.</span>
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {TYPES.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.06}>
                <button
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition",
                    type === t.id ? "border-accent/60 bg-accent/[0.06]" : "border-line bg-surface/40 hover:border-line-strong",
                  )}
                >
                  <t.icon className={cn("mt-0.5 size-6 shrink-0", type === t.id ? "text-accent" : "text-faint")} />
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <p className="mt-1 text-sm text-muted">{t.body}</p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={0.1}>
          <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {state.ok ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <PartyPopper className="size-10 text-accent" />
                  <h3 className="mt-4 text-2xl font-semibold">Thanks, {state.contact}.</h3>
                  <p className="mt-2 max-w-sm text-muted">We&apos;ve noted {state.name}&apos;s interest and will reach out personally. Early partners get set up by the founders.</p>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submitWithoutReset(action)} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <h3 className="text-xl font-semibold">Become an early partner</h3>
                  <input type="hidden" name="type" value={type} />
                  <div role="group" aria-label="Organization type" className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className="rounded-full border border-line px-4 py-1.5 text-sm text-muted transition aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={type === "club" ? "Club name" : "Organization name"}><input name="name" maxLength={120} autoComplete="organization" className={inputCls} required /></Field>
                    <Field label="Your name"><input name="contact" maxLength={80} autoComplete="name" className={inputCls} required /></Field>
                    <Field label={type === "company" ? "Work email" : "School email"}><input name="email" type="email" maxLength={120} autoComplete="email" className={inputCls} required /></Field>
                    <Field label="Your role"><input name="role" maxLength={60} placeholder={type === "club" ? "e.g. President" : "e.g. University recruiter"} className={inputCls} /></Field>
                  </div>
                  <p role="status" className="min-h-5 text-sm text-danger">{state.message}</p>
                  <Button type="submit" size="lg" disabled={pending} className="self-start">
                    {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Sending…" : "Register interest"}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
