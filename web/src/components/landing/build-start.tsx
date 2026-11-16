"use client";
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input id="closing-build" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} autoComplete="off" enterKeyHint="go"
          onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref("", build)); }}
          placeholder="What are you building?"
          className="h-12 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 text-left text-[16px] transition outline-none placeholder:text-faint focus:border-text focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_9%,transparent)]" />
        <Link href={signupHref("", typed)} className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">
          {build ? "Start with this build" : "Create your free account"}
        </Link>
      </div>
    </div>
  );
}
