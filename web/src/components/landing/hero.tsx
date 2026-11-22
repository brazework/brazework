"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cleanBuild, signupHref } from "@/lib/front-door";
import { ProofStage } from "./proof-stage";

// The hero: one line, one box, and the product happening beside it. Type what you're building and it
// becomes the milestone in the demo (proof-stage.tsx), which a club officer then signs (the example;
// the line under the heading names the others who can: a coworker, a mentor). The button
// carries the line into sign-up (?build=, lib/front-door.ts), where it's waiting as your first build.
export function Hero() {
  const [typed, setTyped] = useState("");
  // What they typed, tidied; "" until it's long enough to be a build.
  const build = cleanBuild(typed);
  return (
    <section id="top" className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div aria-hidden="true" className="landing-grid absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16">
        <div className="min-w-0">
          <h1 className="text-[clamp(2.9rem,7vw,5.25rem)] leading-[0.95] font-semibold tracking-[-0.05em]">
            Prove what
            <br />
            you built.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted sm:text-xl sm:leading-relaxed">
            {/* A phone gets the short version: the demo below shows the rest. */}
            <span className="sm:hidden">For students and professionals: your work, signed by the people who saw it, and a guide to where you&apos;re headed next.</span>
            <span className="hidden sm:inline">For students and working professionals in engineering, research, design and software: a record of your work, signed by the people who saw it. Log what you finished, ask your professor, your club or your coworker to sign, and it stays yours wherever you go next.</span>
          </p>

          <div className="mt-9 max-w-[34rem]">
            <label htmlFor="hero-build" className="text-sm font-medium">What are you building?</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input id="hero-build" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} autoComplete="off" enterKeyHint="go"
                onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref("", build)); }}
                placeholder="A line-following robot"
                aria-describedby="hero-build-hint" aria-controls="hero-preview"
                className="h-12 w-full min-w-0 shrink-0 rounded-xl border border-line-strong bg-surface px-4 text-[16px] transition outline-none placeholder:text-faint focus:border-text focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_9%,transparent)]" />
              <Button href={signupHref("", typed)} size="lg" className="h-12 shrink-0 rounded-xl px-5">{build ? "Start with this build" : "Create your free account"}</Button>
            </div>
            <p id="hero-build-hint" className="mt-2.5 text-sm text-faint">{build ? "That's your first milestone. Take it with you." : "Type what you built and watch it get signed."} Free for everyone who builds.</p>
          </div>

          <p className="mt-9 hidden text-sm text-muted sm:block">
            Running a club? <a href="#clubs" className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">See what officers get</a>
            <span className="mx-2 text-line-strong" aria-hidden="true">|</span>
            Hiring? <a href="#companies" className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">Search signed work</a>
          </p>
        </div>

        <ProofStage build={build} />
      </div>
    </section>
  );
}
