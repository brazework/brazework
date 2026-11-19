import { cn } from "@/lib/forge";

// The one next step on a page (docs/design/app.md): an icon, one sentence, one button. A page shows at
// most one. The page decides the step; this only draws it (the project page's logic is lib/next-step.ts).
// `toward`: the member's goal ("a summer internship in power electronics"), so the step reads as a
// step toward it. `aside`: something quiet after the button, like a "Set a goal" link.

export const nextButtonCls = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-text px-3 text-xs font-semibold text-surface transition hover:opacity-90 active:scale-95 motion-reduce:active:scale-100";

export function NextStrip({ icon, toward, action, aside, label = "Next", id, className, children }: {
  icon: React.ReactNode; toward?: string | null; action?: React.ReactNode; aside?: React.ReactNode; label?: string; id?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-label={label} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-2 [&_svg]:size-4" aria-hidden="true">{icon}</span>
      <p className="min-w-0 flex-1 basis-56 text-[15px] leading-snug text-text-2">
        {toward && <span className="font-medium text-text">Toward {toward}: </span>}
        {children}
      </p>
      {action}
      {aside}
    </section>
  );
}
