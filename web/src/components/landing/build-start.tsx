"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cleanBuild, signupHref } from "@/lib/front-door";

// The closing section's way in: the same question the page opened with. Type what you're building
// and the button takes it into sign-up, where it's waiting as your first build (lib/front-door.ts).
// With nothing typed, the button is a plain "create your account".
export function BuildStart() {
  const [typed, setTyped] = useState("");
  const build = cleanBuild(typed);
  return (
    <div className="mt-10 w-full max-w-xl">
      <label htmlFor="closing-build" className="sr-only">What are you building?</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="closing-build" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} autoComplete="off" enterKeyHint="go"
          onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref("", build)); }}
          placeholder="What are you building?"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-left text-[16px] transition outline-none placeholder:text-faint focus:border-line-strong focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_9%,transparent)]" />
        <Link href={signupHref("", typed)} className="bg-accent-grad group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-on-accent transition hover:opacity-90">
          {build ? "Start with this build" : "Create your free account"} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
