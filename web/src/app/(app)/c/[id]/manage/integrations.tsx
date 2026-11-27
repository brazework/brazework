import { Bot, FileUp, GitBranch, Plug } from "lucide-react";
import Link from "next/link";

const EXAMPLES = [
  ["Design and media", "Figma prototypes, Canva designs, Behance projects or video edits"],
  ["Engineering and trades", "Onshape or Fusion models, test footage or build photos"],
  ["Research and data", "Overleaf papers, Colab notebooks, datasets or lab reports"],
  ["Business and education", "Google Drive or OneDrive docs, campaign reports or lesson materials"],
  ["Software and IT", "GitHub or GitLab changes, Jira issue links or a live site"],
] as const;

export function Integrations() {
  const card = "rounded-xl border border-line bg-surface p-5";
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 font-semibold"><Plug className="size-4" aria-hidden="true" /> How work reaches your club</h2>
        <p className="mt-1 text-sm text-muted">Members can log results from any field and attach evidence their reviewer can open. A club verification still comes from an officer who can review the work.</p>
      </section>

      <section className={card}>
        <h3 className="flex items-center gap-2 font-semibold"><FileUp className="size-4" aria-hidden="true" /> Add evidence from any tool</h3>
        <p className="mt-2 text-sm text-muted">Log a milestone and add a viewable link, screenshot, photo, video or file. Use an attachment when the original lives in a private workspace.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXAMPLES.map(([field, examples]) => (
            <div key={field}>
              <dt className="text-sm font-medium">{field}</dt>
              <dd className="mt-0.5 text-sm text-muted">{examples}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h3 className="flex items-center gap-2 font-semibold"><Bot className="size-4" aria-hidden="true" /> Draft with a connected AI tool</h3>
          <p className="mt-2 text-sm text-muted">Members can use Claude, Cursor, VS Code or Codex to turn their work into a draft update or milestone. They review the draft and choose who should sign it.</p>
          <Link href="/settings/tools" className="mt-3 inline-block text-sm font-medium hover:underline">Connect an AI tool →</Link>
        </section>
        <section className={card}>
          <h3 className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" aria-hidden="true" /> Import from GitHub</h3>
          <p className="mt-2 text-sm text-muted">Members can start a project from a public GitHub repository. Brazework fills in project details for them to review.</p>
          <Link href="/projects" className="mt-3 inline-block text-sm font-medium hover:underline">Open projects →</Link>
        </section>
      </div>
    </div>
  );
}
