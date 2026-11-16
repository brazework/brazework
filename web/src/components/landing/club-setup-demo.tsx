"use client";
import { Check, Link2, ScrollText } from "lucide-react";
import { useState } from "react";
import { inviteMessage } from "@/lib/club-setup";
import { cn } from "@/lib/forge";

// The officer's first five minutes, to try: the same "Set up your club" card a new club's owner
// sees (app/(app)/c/[id]/setup.tsx), with the two steps that happen right on it. Example club; the
// invite link isn't a real one.
const STEPS = [
  { id: "about", label: "Say what the club builds", why: "Members decide to join from this." },
  { id: "rules", label: "Post your rules", why: "Clear rules make moderation easy." },
  { id: "invite", label: "Create an invite link", why: "Share one link in your group chat and members land in the club." },
  { id: "event", label: "Host your first event", why: "Build nights and demo days bring members back." },
  { id: "verify", label: "Verify a member's milestone", why: "Your club's name on members' work is what makes Brazework different." },
] as const;
type Id = (typeof STEPS)[number]["id"];

export function ClubSetupDemo() {
  const [done, setDone] = useState<Id[]>(["about"]);
  const tick = (id: Id) => setDone((v) => (v.includes(id) ? v : [...v, id]));
  const next = STEPS.find((s) => !done.includes(s.id));
  const invited = done.includes("invite");
  return (
    <div className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-[var(--shadow-float)] sm:p-6">
      <p className="font-semibold">Set up your club</p>
      <p className="mt-0.5 text-sm text-muted" aria-live="polite">{done.length} of {STEPS.length} done. Most clubs finish in about five minutes.</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={done.length} aria-label="Setup progress">
        <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(done.length / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-4 flex flex-col gap-1">
        {STEPS.map((s) => {
          const ok = done.includes(s.id), isNext = next?.id === s.id;
          return (
            <li key={s.id} className={cn("flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2", isNext && "bg-surface-2/70")}>
              <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-full border transition-colors", ok ? "border-transparent bg-ok text-white dark:text-[#06240f]" : "border-line-strong")}>{ok && <Check className="size-3.5" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", ok ? "text-muted line-through decoration-line-strong" : "font-medium")}>{s.label}</span>
                {isNext && <span className="block text-xs text-muted">{s.why}</span>}
              </span>
              {/* Phones: the button sits under its step, in line with the text. */}
              {!ok && (s.id === "rules" || s.id === "invite") && (
                <span className="basis-full pl-9 sm:basis-auto sm:pl-0">
                  {s.id === "rules"
                    ? <button type="button" onClick={() => tick("rules")} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium transition hover:border-line-strong hover:bg-hover"><ScrollText className="size-3.5" /> Use starter rules</button>
                    : <button type="button" onClick={() => tick("invite")} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent transition hover:opacity-90"><Link2 className="size-3.5" /> Get invite link</button>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/* The invite, ready for the group chat the club already uses. */}
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-500", invited ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!invited}>
        <div className="overflow-hidden">
          <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3.5">
            <p className="text-xs font-medium text-text-2">Paste this in your club&apos;s group chat</p>
            <p className="mt-1.5 text-sm leading-snug text-text-2">{inviteMessage("Rocketry Club", "brazework.com/join/your-link")}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">Example club. Try the two buttons.</p>
    </div>
  );
}
