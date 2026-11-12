import { Bot, CalendarSync, GitBranch, Plug } from "lucide-react";
import Link from "next/link";

// A club's integrations (admins). Discord was removed (Linear FIX-92): announcements happen on
// Brazework, where verified work lives. What's here is what members' work flows in through: GitHub,
// and the AI tools they already use (MCP). Ember drafts for officers from Manage.
export function Integrations() {
  const card = "rounded-xl border border-line bg-surface p-5";
  const live = <span className="ml-auto rounded-md bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-ok">Live</span>;
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 font-semibold"><Plug className="size-4" /> How work reaches your club</h2>
        <p className="mt-1 text-sm text-muted">Members bring their work in from the tools they build with. Whatever comes in, only an officer of this club can verify it.</p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={card}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-text text-bg"><GitBranch className="size-5" /></span><h3 className="font-semibold">GitHub</h3>{live}</div>
          <p className="mt-3 text-sm text-muted">Members import a public repo as a project (Projects → New → Import from GitHub): title, write-up, link and topics are filled in, and its releases are suggested as milestones to send you for verification.</p>
        </section>
        <section className={card}>
          <div className="flex items-center gap-3"><span className="bg-accent-grad grid size-10 place-items-center rounded-lg text-on-accent"><Bot className="size-5" /></span><h3 className="font-semibold">Members&apos; AI tools</h3>{live}</div>
          <p className="mt-3 text-sm text-muted">Members connect Claude Code, Cursor, VS Code or Codex, and their tool logs build updates and milestones for them as they work, labelled with the tool. A milestone still waits for one of your officers.</p>
          <Link href="/settings/tools" className="mt-3 inline-block text-sm font-medium hover:underline">How members connect →</Link>
        </section>
      </div>

      <section className="rounded-xl border border-dashed border-line-strong p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarSync className="size-4" /> Coming next</h3>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
          <li>· GitHub live sync: merged pull requests, releases and CI results in a project&apos;s build log</li>
          <li>· Calendar subscription for club events</li>
          <li>· Onshape and Fusion 360 project imports</li>
        </ul>
      </section>
    </div>
  );
}
