import { cn } from "@/lib/forge";

// The pieces the story screens are drawn with (sticky-story.tsx): an app bar, rows, people and
// buttons in the app's own look, small enough to read on a phone. Example content only.

export function Screen({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 pt-4 pb-3 lg:pt-11">
        <p className="text-[15px] font-semibold tracking-tight">{title}</p>
        {sub && <p className="mt-0.5 text-[12px] text-faint">{sub}</p>}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-hidden p-3.5", className)}>{children}</div>
    </div>
  );
}

export function Face({ name, tone = 0 }: { name: string; tone?: number }) {
  const initials = name.replace(/^(Prof\.|Dr\.)\s*/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("");
  const tints = ["#e8946a", "#7aa7ff", "#7fd1a8", "#d9a6ff", "#f2c46d"];
  return <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-[#14151a]" style={{ background: tints[tone % tints.length] }}>{initials}</span>;
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-[13px]", className)}>{children}</div>;
}

export function Pill({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] whitespace-nowrap", on ? "border-transparent bg-brand text-bg" : "border-line text-text-2")}>{children}</span>;
}

export function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug", me ? "ml-auto rounded-br-md bg-accent text-on-accent" : "rounded-bl-md border border-line bg-surface-2/70")}>{children}</div>;
}
