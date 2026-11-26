import type { Metadata } from "next";
import { ArrowRight, BriefcaseBusiness, Check, Eye, FileText, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/app/verified-seal";
import { Footer } from "@/components/landing/closing";
import { Nav } from "@/components/landing/nav";
import { H2 } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { PLUS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "For professionals",
  description: "Log what you finished at work, get it signed by the coworker, manager or client who saw it, and keep the record when you change jobs. Free, with Plus for review packets.",
};

// /professionals: the page for working engineers and builders who aren't students (the market from
// before the school-first realignment, kept beside it). The same flow the app has always had: log a
// milestone with its proof, ask someone who saw it, and it's on your record with their name.
// Static, in the same layout as /schools.

const WORK = "Cut the pick-and-place cycle from 9.4 to 7.1 seconds";
const STEPS = [
  { title: "Log what you finished", body: "One sentence, plus a link or a file that shows it: a pull request, a test log, a photo, a CAD file." },
  { title: "Ask someone who saw it", body: "Your coworker, manager, client or mentor gets one email and signs in under a minute. They don't need an account." },
  { title: "It's on your record", body: "With their name and role on it. Share it, put it on your résumé, and keep it when you change jobs." },
];

const GETS = [
  { icon: Lock, title: "Safe at work", body: "Signers sign as themselves, with their own work email. Work stays off your public profile until you choose to show it, so nothing leaks before it should." },
  { icon: FileText, title: "Your review packet", body: "Every signed result from any period on one page, each with who signed it and their role. Ready for a performance review or a promotion case." },
  { icon: Eye, title: "See who looked", body: "Companies find you by work someone signed, not by keywords. See which ones looked, and reply only to requests you accept." },
  { icon: Sparkles, title: "Your AI fills it in", body: "Connect Claude or ChatGPT and it drafts milestones from your tools and notes, with your OK before anything is saved." },
];

const FREE = ["Your record: every project, with the people who signed it", "Ask a coworker, manager, client or mentor to sign", "A share card for every milestone, signed or waiting", "Be found by companies, and see who looked"];
const PLUS_GETS = ["Review packets for any period", "Every company that looked in the last 90 days, by name", "More Torch credits each day"];

export default function ProfessionalsPage() {
  return (
    <div className="landing min-h-dvh">
      <Nav />
      <ThemeChrome landing />
      <main>
        <section id="top" aria-labelledby="pros-h" className="theme-dark relative isolate overflow-hidden bg-bg pt-28 pb-14 text-text sm:pt-32 md:pb-20">
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="inline-flex items-center gap-2 font-mono text-xs text-faint"><BriefcaseBusiness className="size-3.5" aria-hidden="true" /> Brazework for professionals</p>
            <h1 id="pros-h" className="mt-4 max-w-[17ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">Your work, signed by the people who saw it.</h1>
            <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-muted">A résumé says what you claim. Brazework shows what you finished, with the coworker, manager or client who saw it signing their name. Log a milestone, get it signed, and keep the record wherever you work next.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Create your free account <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="#how" className="inline-flex h-12 items-center rounded-xl border border-line-strong px-5 text-[15px] transition hover:bg-hover">How it works</Link>
            </div>
            <p className="mt-4 text-sm text-faint">Free for everyone who builds. Already a student? Move to your personal email when you graduate and everything comes with you.</p>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="scroll-mt-20 border-b border-line bg-surface-2/60 py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="how-h" className={H2}>Log it. Get it signed. Keep it.</h2>
            <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-muted">That&apos;s the whole idea. It takes a few minutes, and the person who signs doesn&apos;t need an account.</p>
            <ol aria-label="How it works" className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                  <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{s.body}</p>
                  <figure className={`mt-5 rounded-xl border bg-surface px-4 py-3.5 ${i === 1 ? "border-dashed border-wait" : i === 2 ? "border-ok" : "border-line"}`}>
                    <p className="text-sm leading-snug font-medium">{WORK}</p>
                    <figcaption className="mt-2.5 flex min-h-9 items-center gap-2 text-xs leading-snug text-muted">
                      {i === 0 && <><FileText className="size-4 shrink-0" aria-hidden="true" /><span>Logged, with <span className="font-medium text-text-2">cycle-test-log.csv</span> as proof</span></>}
                      {i === 1 && <><span aria-hidden="true" className="block size-4 shrink-0 rounded-full border-2 border-dashed border-wait" /><span>Waiting for <span className="font-medium text-text-2">Dana R.</span>, engineering coworker</span></>}
                      {i === 2 && <><Seal size={18} tone="pro" /><span>Signed by <span className="font-medium text-text-2">Dana R.</span>, coworker at Voltline</span></>}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-faint">An example, to show how an entry reads at each step.</p>
          </div>
        </section>

        <section aria-labelledby="gets-h" className="py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="gets-h" className={H2}>Built for people with a day job</h2>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-10">
              {GETS.map((g) => (
                <li key={g.title} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                  <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-text-2"><g.icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{g.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{g.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="price" aria-labelledby="price-h" className="scroll-mt-20 border-t border-line py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="price-h" className={H2}>Free to start. Plus when you want more.</h2>
            <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2">
              <div className="flex flex-col rounded-[1.25rem] border border-line bg-surface p-6 sm:p-8">
                <p className="text-sm font-medium text-muted">Free</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">$0</p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[15px] text-text-2">
                  {FREE.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />{x}</li>)}
                </ul>
                <Link href="/signup" className="mt-6 inline-flex h-11 items-center justify-center self-start rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Create your free account</Link>
              </div>
              <div className="flex flex-col rounded-[1.25rem] border border-line bg-surface p-6 sm:p-8">
                <p className="text-sm font-medium text-muted">{PLUS.name}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">${PLUS.everyoneYear}<span className="text-lg font-normal text-muted"> / year</span></p>
                <p className="mt-1 text-sm text-muted">Or ${PLUS.everyone} a month. Students never pay.</p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[15px] text-text-2">
                  {PLUS_GETS.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />{x}</li>)}
                </ul>
                <Link href="/plus" className="mt-6 inline-flex h-11 items-center justify-center self-start rounded-lg border border-line-strong px-5 text-[15px] transition hover:bg-hover">See Plus</Link>
              </div>
            </div>
            <p className="mt-6 text-sm text-muted">Hiring? <Link href="/pricing#pricing-companies" className="font-medium text-text underline-offset-4 hover:underline">Find people by signed work</Link>.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
