import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/closing";
import { Nav } from "@/components/landing/nav";
import { ThemeChrome } from "@/components/theme-chrome";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";
import { StickyStory, type StoryStep } from "./sticky-story";
import { Tilt } from "./tilt";

// One page for each kind of member (2026-11-27): /for/students, /for/professionals and /for/clubs
// (app/for/*). The same shape everywhere, so the site reads as one story: what it is for you, how
// it goes (a scroll story, sticky-story.tsx, phone first), what's free, and the rest of Brazework.
// /schools is the fourth, longer page for the people who buy. No prices here: /pricing has them.

export type Audience = {
  id: "students" | "professionals" | "clubs";
  title: React.ReactNode;
  lead: string;
  promise: string;
  cta: { label: string; href: string };
  second?: { label: string; href: string };
  storyH: string;
  steps: StoryStep[];
  facts: string[];
  close: string;
};

const ALL = [
  { id: "students", name: "Students", line: "Classes, clubs and projects in one place, signed by who saw it.", href: "/for/students" },
  { id: "professionals", name: "Professionals", line: "What you ship at work, signed by your team or client.", href: "/for/professionals" },
  { id: "clubs", name: "Clubs", line: "Run the club in one place and stand behind what members build.", href: "/for/clubs" },
  { id: "schools", name: "Schools", line: "Run project courses on it; every office gets its evidence.", href: "/schools" },
] as const;

export function AudiencePage({ a }: { a: Audience }) {
  return (
    <div className="landing min-h-dvh">
      <Nav />
      <ThemeChrome landing />
      <main>
        <section id="top" aria-labelledby="aud-h" className="relative isolate overflow-hidden pt-[calc(env(safe-area-inset-top)+7.5rem)] pb-6 sm:pt-36 md:pb-10">
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-text-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-brand" /> {a.promise}</p>
            <h1 id="aud-h" className="mt-6 max-w-[15ch] text-[clamp(2.6rem,8.5vw,4.75rem)] leading-[0.98] font-semibold tracking-[-0.05em] text-balance">{a.title}</h1>
            <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-muted sm:text-xl">{a.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={a.cta.href} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent px-6 text-[16px] font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98]">{a.cta.label} <ArrowRight className="size-4" aria-hidden="true" /></Link>
              {a.second && <Link href={a.second.href} className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong px-6 text-[16px] transition hover:bg-hover active:scale-[0.98]">{a.second.label}</Link>}
            </div>
          </div>
        </section>

        <section id="story" aria-labelledby="story-h" className="scroll-mt-20 pt-14 md:pt-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="story-h" className={cn(H2, "max-w-[20ch]")}>{a.storyH}</h2>
            <div className="mt-8 lg:mt-0">
              <StickyStory label={a.storyH} steps={a.steps} />
            </div>
          </div>
        </section>

        <section aria-labelledby="facts-h" className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="facts-h" className="sr-only">Good to know</h2>
            <ul className="grid grid-cols-1 gap-x-10 gap-y-6 border-t border-line pt-10 md:grid-cols-3">
              {a.facts.map((f) => <li key={f} className="text-[17px] leading-relaxed text-text-2">{f}</li>)}
            </ul>
          </div>
        </section>

        <section aria-labelledby="also-h" className="pb-16 md:pb-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="also-h" className="text-2xl font-semibold tracking-tight">One record for everyone who builds</h2>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ALL.filter((x) => x.id !== a.id).map((x) => (
                <Tilt as="li" key={x.id} className="rounded-2xl border border-line bg-surface">
                  <Link href={x.href} className="flex h-full flex-col p-5">
                    <span className="flex items-center justify-between text-lg font-semibold tracking-tight">{x.name}<ArrowRight className="size-4 text-faint" aria-hidden="true" /></span>
                    <span className="mt-1.5 text-[15px] leading-relaxed text-muted">{x.line}</span>
                  </Link>
                </Tilt>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="close-h" className="border-t border-line bg-surface-2/50 py-16 md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 id="close-h" className="max-w-[22ch] text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold tracking-[-0.03em] text-balance">{a.close}</h2>
            <Link href={a.cta.href} className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-6 text-[16px] font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] sm:w-auto">{a.cta.label} <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
