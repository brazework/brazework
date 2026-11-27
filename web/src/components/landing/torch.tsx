"use client";
import { ArrowRight, Check, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";
import { Bubble, Face, Row, Screen } from "./screens";
import { StickyStory } from "./sticky-story";

// Torch, the AI built in (landing, 2026-11-27): try it by scrolling. Pick a class project, a club
// build or something from work, then scroll: one sentence in, a write-up out, who should sign it,
// and nothing saved until you say yes (the last screen's buttons answer). Scripted examples: nothing
// on this page calls the AI or saves anything. Torch never signs and never acts on its own.

const CASES = {
  class: { chip: "A class project", said: "We got the rover planner to 48 of 50 goals in the yard, no collisions", title: "Planner reached 48 of 50 goals in the cluttered yard, with no collisions", where: "CS 485 Mobile Robotics, Lab 4", proof: "yard-run-12.mcap", signer: "Prof. Iyer", why: "Your CS 485 professor. She ran the yard test with your team." },
  club: { chip: "A club build", said: "Our quad held position in 15 km/h wind, six flights", title: "Held position within 0.3 m in 15 km/h wind over 6 test flights", where: "Aerial Robotics Club", proof: "hover-flights.bbl", signer: "A. Novak", why: "President of Aerial Robotics. Ran the flight tests." },
  work: { chip: "Something from work", said: "Shipped the CI cache, builds went from 22 to 9 minutes", title: "Cut CI from 22 to 9 minutes with a shared build cache", where: "Northwind Aero, private until you choose", proof: "ci-before-after.png", signer: "R. Okoro", why: "Staff engineer on your team. Reviewed the change." },
} as const;
type Case = keyof typeof CASES;

function TorchSays({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2"><Ember mood="happy" size={22} label="Torch" /><div className="min-w-0 flex-1">{children}</div></div>;
}

export function Torch() {
  const [pick, setPick] = useState<Case>("class");
  const [answer, setAnswer] = useState<"" | "yes" | "later">("");
  const c = CASES[pick];
  const choose = (k: Case) => { setPick(k); setAnswer(""); };

  const steps = [
    {
      title: "Tell it in one sentence",
      body: "However you'd say it to a friend. If something's missing, Torch asks.",
      screen: <Screen title="Torch" sub="Your AI teammate"><div className="flex flex-col gap-2.5"><Bubble me>{c.said}</Bubble><TorchSays><Bubble>Nice. Do you have the file that shows it?</Bubble></TorchSays><Bubble me><span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden="true" />{c.proof}</span></Bubble></div></Screen>,
    },
    {
      title: "It writes it up",
      body: "A clear milestone with the proof attached, filed under the right class, club or job.",
      screen: <Screen title="Draft" sub="Written by Torch, yours to edit"><div className="rounded-2xl border border-line bg-surface-2/50 p-3.5"><p className="text-[11px] text-faint">{c.where}</p><p className="mt-1.5 text-[15px] leading-snug font-semibold">{c.title}</p><p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted"><FileText className="size-3.5" aria-hidden="true" />{c.proof}</p></div><p className="mt-3 text-[12px] text-faint">Edit anything before it&apos;s saved.</p></Screen>,
    },
    {
      title: "It finds who should sign",
      body: "Someone who saw it happen. Torch suggests them and says why; you choose.",
      screen: <Screen title="Who should sign" sub="Suggested by Torch"><div className="flex flex-col gap-2"><Row className="border-brand/50"><Face name={c.signer} /><span className="min-w-0"><span className="block font-medium">{c.signer}</span><span className="block text-[12px] text-muted">{c.why}</span></span></Row><Row className="opacity-60"><Face name="Someone else" tone={1} /><span>Choose someone else</span></Row></div></Screen>,
    },
    {
      title: "Nothing is saved until you say yes",
      body: "Torch never signs anything and never posts on its own. Try it: the buttons answer.",
      screen: (
        <Screen title="Ready when you are">
          <TorchSays><Bubble>Save “{c.title}” and ask {c.signer} to sign it?</Bubble></TorchSays>
          {answer === "" ? (
            <div className="mt-4 flex gap-2 pl-8">
              <button type="button" onClick={() => setAnswer("yes")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-on-accent active:scale-95">Yes, save it</button>
              <button type="button" onClick={() => setAnswer("later")} className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-[13px] active:scale-95">Not yet</button>
            </div>
          ) : (
            <p role="status" className="mt-4 ml-8 inline-flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-[13px]">
              {answer === "yes" ? <><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />Saved as yours, and {c.signer} was asked to sign. (An example: nothing is sent from this page.)</> : <>Kept as a draft. Nothing was saved or sent.</>}
            </p>
          )}
        </Screen>
      ),
    },
  ];

  return (
    <section id="torch" aria-labelledby="torch-h" className="scroll-mt-20 border-y border-line py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex items-center gap-3"><Ember mood="happy" size={40} label="Torch" /><span className="text-sm text-muted">Torch, the AI built in</span></div>
        <h2 id="torch-h" className={cn(H2, "mt-5 max-w-[20ch]")}>Torch does the busywork. You say yes.</h2>
        <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-muted">Tell it what you did and it writes it up, finds who should sign and waits for your yes. It also plans your week and can start a club or study group for you.</p>
        <div role="group" aria-label="Try it with" className="mt-7 flex flex-wrap gap-2">
          {(Object.keys(CASES) as Case[]).map((k) => (
            <button key={k} type="button" aria-pressed={pick === k} onClick={() => choose(k)}
              className={cn("h-10 rounded-lg border px-4 text-[14px] transition active:scale-95", pick === k ? "border-transparent bg-accent text-on-accent" : "border-line-strong text-text-2 hover:bg-hover")}>
              {CASES[k].chip}
            </button>
          ))}
        </div>
        <div className="mt-6 lg:mt-2">
          <StickyStory label={`Torch, from one sentence to a saved milestone: ${c.chip.toLowerCase()} (example)`} steps={steps} />
        </div>
        <Link href="/ai" className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-text underline-offset-4 hover:underline">Use it from Claude or ChatGPT <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
