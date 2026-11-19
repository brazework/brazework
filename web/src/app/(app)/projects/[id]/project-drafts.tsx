import { DraftCard } from "@/app/(app)/drafts/draft-card";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { draftToProposal, isCardKind } from "@/lib/tool-actions";
import type { ToolDraft } from "@/lib/tool-drafts";

// What Ember or your AI tools drafted for this project, waiting for you, right in its timeline (the
// same cards as /drafts: supabase/tool-actions.sql). Nothing is posted or sent until you press the
// card's button. Only the member who owns a draft can read it (row-level security).
export function ProjectDrafts({ drafts, projectTitle, clubName }: { drafts: ToolDraft[]; projectTitle: string; clubName: Map<string, string> }) {
  if (!drafts.length) return null;
  return (
    <section id="drafts" aria-label="Drafts for this project" className="mt-4 scroll-mt-24">
      <h3 className="text-xs font-medium text-muted">Waiting for your OK · {drafts.length}</h3>
      <ul className="mt-2 space-y-3">
        {drafts.map((d) => {
          const card = isCardKind(d.kind) ? draftToProposal(d) : null;
          const club = typeof d.payload.club_id === "string" ? clubName.get(d.payload.club_id) ?? null : null;
          return <li key={d.id}>{card ? <ProposalCard p={card} inline fromTool={{ draftId: d.id, via: d.via, source: d.source }} /> : <DraftCard draft={d} project={projectTitle} club={club} />}</li>;
        })}
      </ul>
    </section>
  );
}

/** A draft's name for the Next strip: its title, or the start of its text. */
export function draftTitle(d: ToolDraft): string {
  const t = (d.payload.title || d.payload.body || "").trim();
  return t.length > 70 ? `${t.slice(0, 69).trimEnd()}…` : t || "A draft";
}
