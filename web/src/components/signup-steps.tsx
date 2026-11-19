import { cn } from "@/lib/forge";

// Where a newcomer is on the way in, the same on every step. The way in is build-first (the
// Product Hunt launch, docs/superpowers/specs/2026-11-19-product-hunt-launch-design.md): Account →
// About you → Your build → Proof → Who saw it, for students and professionals alike. Someone who
// hasn't built anything yet can set up their profile instead: Account → About you → Your work →
// Your club (students only; a club's officers verify their work). Server- and client-renderable.
export type SignupStep = "account" | "about" | "build" | "proof" | "signer" | "work" | "club";
export type SignupPath = "build" | "profile";
const LABEL: Record<SignupStep, string> = {
  account: "Account", about: "About you", build: "Your build", proof: "Proof", signer: "Who saw it", work: "Your work", club: "Your club",
};

export function signupSteps(path: SignupPath = "build", student = true): { id: SignupStep; label: string }[] {
  const ids: SignupStep[] = path === "build" ? ["account", "about", "build", "proof", "signer"] : ["account", "about", "work", ...(student ? (["club"] as const) : [])];
  return ids.map((id) => ({ id, label: LABEL[id] }));
}

export function SignupSteps({ at, path = "build", student = true, className }: { at: SignupStep; path?: SignupPath; student?: boolean; className?: string }) {
  const steps = signupSteps(path, student);
  const i = Math.max(0, steps.findIndex((s) => s.id === at));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline gap-2 text-[11px] font-medium tracking-[0.06em] uppercase">
        <span className="text-accent">Step {i + 1} of {steps.length}</span>
        <span className="text-faint">· {steps[i].label}</span>
      </div>
      <ol aria-label={`Step ${i + 1} of ${steps.length}: ${steps[i].label}`} className="flex gap-1.5">
        {steps.map((s, n) => (
          <li key={s.id} className="flex-1" aria-current={n === i ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full transition-colors duration-300", n <= i ? "bg-accent" : "bg-raised")} />
            <span className="sr-only">{s.label}{n < i ? " (done)" : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
