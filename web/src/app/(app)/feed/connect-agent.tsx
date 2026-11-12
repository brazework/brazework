import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Orb } from "@/components/landing/orb";

// Bring your own agent, on Home (Linear FIX-92): for members who haven't connected an AI tool yet.
// Gone once they have. The same orb as the landing page, so it reads as the same idea.
export function ConnectAgentCard() {
  return (
    <section aria-label="Bring your own agent" className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <Orb tone="auto" className="size-12 shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight">Bring your own agent</p>
          <p className="text-xs text-muted">Claude Code, Cursor or Codex</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-2">Let the AI you already code with log your progress as you work. It reads your Brazework; it posts only if you allow it, and never verifies anything.</p>
      <Link href="/settings/tools" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Connect in a minute <ArrowRight className="size-3.5" /></Link>
    </section>
  );
}
