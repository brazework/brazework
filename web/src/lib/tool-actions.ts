import type { Proposal, Spec } from "@/lib/copilot-agent";
import { ALL_TOPICS } from "@/lib/forge";

// One set of actions behind AI tools (MCP) and Ember (supabase/tool-actions.sql, docs/mcp-workflows.md).
// A tool's draft is stored with the same kind as an Ember card and shown as that card, on /drafts and
// on Ember's page: Confirm runs the app's own action, exactly as when Ember proposed it. Pure, so the
// server, the pages and tests share it (tests/tool-actions.test.ts).

/** Kinds a tool can leave as a draft. post and milestone keep their own card (drafts/draft-card.tsx). */
export const CARD_KINDS = ["project", "project_edit", "teammate"] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export const isCardKind = (k: string): k is CardKind => (CARD_KINDS as readonly string[]).includes(k);

export type ToolDraftRow = { id: string; kind: string; via: string; source: string; created_at: string; payload: Record<string, unknown> };

const s = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const specs = (v: unknown): Spec[] => (Array.isArray(v) ? v.filter((x): x is Spec => !!x && typeof x === "object" && typeof (x as Spec).label === "string" && typeof (x as Spec).value === "string").slice(0, 16) : []);
const has = (p: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(p, k);

/** Only the app's topics, at most 3: the project form refuses anything else. */
export const appTopics = (tags: unknown): string[] => (Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string" && ALL_TOPICS.includes(t)).slice(0, 3) : []);

/** A tool's draft as the Ember card that confirms it, or null for kinds with their own card. */
export function draftToProposal(d: Pick<ToolDraftRow, "id" | "kind" | "payload">): Proposal | null {
  const p = d.payload ?? {};
  const id = `draft-${d.id}`;
  switch (d.kind) {
    case "project": {
      const link = s(p.link, 300);
      return { id, kind: "project", title: s(p.title, 120), summary: s(p.summary, 600), details: s(p.details), link, tags: appTopics(p.tags),
        status: p.status === "completed" ? "completed" : "in_progress", year: s(p.year, 4), source: link.includes("github.com") ? "GitHub" : "" };
    }
    case "project_edit": {
      const b = (p.before ?? {}) as Record<string, unknown>;
      return {
        id, kind: "project_edit", project_id: s(p.project_id, 64), project_title: s(p.project_title, 120),
        ...(has(p, "summary") && { summary: s(p.summary, 600) }), ...(has(p, "details") && { details: s(p.details) }),
        ...(has(p, "link") && { link: s(p.link, 300) }), ...(has(p, "specs") && { specs: specs(p.specs) }),
        before: { summary: s(b.summary, 600), details: s(b.details), link: s(b.link, 300), specs: specs(b.specs) },
      };
    }
    case "teammate":
      return { id, kind: "teammate", project_id: s(p.project_id, 64), project_title: s(p.project_title, 120), person_id: s(p.person_id, 36), name: s(p.name, 120), headline: s(p.headline, 200), role: p.role === "viewer" ? "viewer" : "member" };
    default:
      return null;
  }
}

/** What the MCP tool sends to mcp_act for each kind, from the tool's arguments. */
export function actionPayload(kind: CardKind, i: Record<string, unknown>): Record<string, unknown> {
  const str = (k: string) => (typeof i[k] === "string" ? (i[k] as string) : undefined);
  switch (kind) {
    case "project":
      return { title: str("title") ?? "", summary: str("summary") ?? "", details: str("details") ?? "", link: str("link") ?? "", status: str("status") ?? "in_progress", year: str("year") ?? "", tags: appTopics(i.tags) };
    case "project_edit": {
      const out: Record<string, unknown> = { project_id: str("project_id") ?? "" };
      for (const k of ["summary", "details", "link"]) if (str(k) !== undefined) out[k] = str(k);
      if (Array.isArray(i.specs)) out.specs = specs(i.specs);
      return out;
    }
    case "teammate":
      return { project_id: str("project_id") ?? "", person_id: str("person_id") ?? "", role: str("role") ?? "member" };
  }
}
