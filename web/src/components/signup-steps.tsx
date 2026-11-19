import { cn } from "@/lib/forge";

// Where a newcomer is on the way in, the same on every step: Account (sign up and confirm the
// email) → About you → Your work → Your club. "Your club" is the students' step (their officers
// verify their work), so a professional's path has three steps; until we know which they are, it
// shows four. Server- and client-renderable: no hooks.
export type SignupStep = "account" | "about" | "work" | "club";
const ALL: { id: SignupStep; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "about", label: "About you" },
  { id: "work", label: "Your work" },
  { id: "club", label: "Your club" },
];

export function signupSteps(club: boolean) {
  return ALL.filter((s) => club || s.id !== "club");
}

export function SignupSteps({ at, club = true, className }: { at: SignupStep; club?: boolean; className?: string }) {
  const steps = signupSteps(club);
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
