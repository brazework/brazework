// The "Add proof" picker's sources (Linear FIX-235): the tools people in each field build with, so no
// field feels second-class and GitHub sits beside the rest. Each says where its link comes from and how
// to share it so the person signing can open it. Pure, so it's tested (tests/proof-tools.test.ts).
//
// Links only, pasted: connecting an account to browse your own files (Google Drive's picker, Figma)
// comes later, once those apps are registered. Names match lib/proof-source.ts, which recognises them.

export type ProofTool = {
  id: string;
  /** As people say it. */
  name: string;
  /** What a link from it looks like (the paste box's placeholder). */
  example: string;
  /** How to make the link open for someone outside: shown under the box, and with a private-looking link. */
  share: string;
};

export const PROOF_TOOLS: ProofTool[] = [
  { id: "github", name: "GitHub", example: "https://github.com/you/project/pull/12", share: "A public repo opens for anyone. For a private one, add a screenshot or a doc as well." },
  { id: "gitlab", name: "GitLab", example: "https://gitlab.com/you/project/-/merge_requests/4", share: "Make the project public, or add a screenshot or a doc as well." },
  { id: "drive", name: "Google Docs & Drive", example: "https://docs.google.com/document/d/…", share: "Share → General access → Anyone with the link → Viewer." },
  { id: "figma", name: "Figma", example: "https://www.figma.com/design/…", share: "Share → Anyone with the link → can view." },
  { id: "onshape", name: "Onshape", example: "https://cad.onshape.com/documents/…", share: "Share → Link → turn on view-only link sharing." },
  { id: "fusion", name: "Fusion", example: "https://a360.co/…", share: "Share → Public link → turn it on." },
  { id: "easyeda", name: "EasyEDA & OSHWLab", example: "https://oshwlab.com/you/board", share: "Publish the project, or share the link as public." },
  { id: "notion", name: "Notion", example: "https://you.notion.site/…", share: "Share → Publish → Publish to web." },
  { id: "overleaf", name: "Overleaf", example: "https://www.overleaf.com/read/…", share: "Share → Turn on link sharing → the view-only link." },
  { id: "arxiv", name: "arXiv & papers", example: "https://arxiv.org/abs/2411.01234", share: "A published paper or preprint opens for anyone." },
  { id: "colab", name: "Google Colab", example: "https://colab.research.google.com/drive/…", share: "Share → Anyone with the link → Viewer." },
  { id: "kaggle", name: "Kaggle", example: "https://www.kaggle.com/code/you/notebook", share: "Make the notebook public." },
  { id: "huggingface", name: "Hugging Face", example: "https://huggingface.co/you/model", share: "A public model, dataset or Space opens for anyone." },
  { id: "linear", name: "Linear", example: "https://linear.app/team/issue/ENG-42", share: "Only your workspace can open it. Add a screenshot or a doc as well, or ask a teammate to sign." },
  { id: "jira", name: "Jira", example: "https://you.atlassian.net/browse/ENG-42", share: "Only your workspace can open it. Add a screenshot or a doc as well, or ask a teammate to sign." },
  { id: "youtube", name: "YouTube", example: "https://youtu.be/…", share: "Public or unlisted both open with the link. Private doesn't." },
  { id: "loom", name: "Loom", example: "https://www.loom.com/share/…", share: "Share → Anyone with the link can view." },
  { id: "canva", name: "Canva", example: "https://www.canva.com/design/…/view", share: "Share → Anyone with the link → view only." },
  { id: "behance", name: "Behance", example: "https://www.behance.net/gallery/…", share: "A published project opens for anyone." },
  { id: "onedrive", name: "OneDrive & SharePoint", example: "https://1drv.ms/…", share: "Share → Anyone with the link can view." },
  { id: "site", name: "A live site or app", example: "https://your-project.vercel.app", share: "Anything public on the web opens for anyone." },
];

const byId = new Map(PROOF_TOOLS.map((t) => [t.id, t]));

// The member's field (lib/forge.ts TOPICS) → its tools, most used first. Six show; the rest are one tap away.
const FIELD_TOOLS: Record<string, string[]> = {
  "Engineering": ["onshape", "fusion", "github", "drive", "youtube", "easyeda"],
  "Computer Science": ["github", "site", "gitlab", "drive", "linear", "jira"],
  "Data & AI": ["github", "colab", "kaggle", "huggingface", "drive", "arxiv"],
  "Mathematics": ["overleaf", "arxiv", "drive", "github", "colab", "youtube"],
  "Physics": ["overleaf", "arxiv", "github", "colab", "drive", "youtube"],
  "Chemistry": ["drive", "overleaf", "arxiv", "youtube", "notion", "onedrive"],
  "Biology & Life Sciences": ["drive", "arxiv", "colab", "github", "youtube", "notion"],
  "Earth & Environment": ["drive", "colab", "github", "arxiv", "youtube", "notion"],
  "Health & Medicine": ["drive", "arxiv", "onedrive", "youtube", "notion", "overleaf"],
  "Space Science": ["github", "fusion", "drive", "colab", "youtube", "arxiv"],
  "Business & Entrepreneurship": ["drive", "canva", "notion", "site", "youtube", "linear"],
  "Design & Arts": ["figma", "behance", "canva", "drive", "youtube", "notion"],
  "Media & Communication": ["youtube", "drive", "canva", "loom", "notion", "site"],
  "Social Sciences & Policy": ["drive", "overleaf", "arxiv", "notion", "colab", "youtube"],
  "Education": ["drive", "youtube", "canva", "notion", "loom", "site"],
};
// No field yet: one from each kind of work, so nobody's tool looks like an afterthought.
const ANY_FIELD = ["drive", "github", "figma", "onshape", "notion", "youtube"];

/** The tools to show first for a field, then the rest in catalogue order. */
export function toolsForField(field: string | null | undefined): { first: ProofTool[]; more: ProofTool[] } {
  const ids = FIELD_TOOLS[field ?? ""] ?? ANY_FIELD;
  const first = ids.map((id) => byId.get(id)).filter((t): t is ProofTool => !!t);
  return { first, more: PROOF_TOOLS.filter((t) => !ids.includes(t.id)) };
}

/** The picker's tool for a link, by the tool name lib/proof-source.ts gives it. */
const SOURCE_TO_TOOL: Record<string, string> = {
  "GitHub": "github", "GitLab": "gitlab", "Google Docs": "drive", "Google Drive": "drive", "Figma": "figma", "Onshape": "onshape", "Fusion": "fusion",
  "EasyEDA": "easyeda", "Notion": "notion", "Overleaf": "overleaf", "arXiv": "arxiv", "Paper": "arxiv", "Google Colab": "colab", "Kaggle": "kaggle",
  "Hugging Face": "huggingface", "Linear": "linear", "Jira": "jira", "YouTube": "youtube", "Loom": "loom", "Canva": "canva", "Behance": "behance",
  "OneDrive": "onedrive", "Live site": "site",
};
export const toolForSource = (sourceTool: string | undefined): ProofTool | undefined => byId.get(SOURCE_TO_TOOL[sourceTool ?? ""] ?? "");

export const MAX_PROOF_LINKS = 8;

/** A pasted link made usable: trimmed, https added or upgraded. "" when it can't be a link. */
export function cleanLink(raw: string): string {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v) ? `https://${v}` : "";
  if (!withScheme) return "";
  try {
    const u = new URL(withScheme);
    if (u.username || u.password || !u.hostname.includes(".")) return "";
  } catch { return ""; }
  // The database takes 12 to 300 characters (supabase/verification.sql, evidence_ok).
  return withScheme.length >= 12 && withScheme.length <= 300 ? withScheme : "";
}

/**
 * Every link a form sent: the cards already added, then whatever is still in the box. Cleaned, without
 * repeats, at most eight. The first is the milestone's evidence; the rest are its evidence_items.
 */
export function evidenceLinks(box: string, cardsJson: unknown): string[] {
  let cards: unknown = [];
  if (typeof cardsJson === "string" && cardsJson) { try { cards = JSON.parse(cardsJson); } catch { cards = []; } }
  const all = [...(Array.isArray(cards) ? cards : []), box].filter((v): v is string => typeof v === "string").map(cleanLink).filter(Boolean);
  return [...new Set(all)].slice(0, MAX_PROOF_LINKS);
}

/** The database's shape for links beyond the first: a commit is a commit, anything else a link. */
export const evidenceItem = (url: string) => ({ type: /^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}/i.test(url) ? "commit" : "link", url });
