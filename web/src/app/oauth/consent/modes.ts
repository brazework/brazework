// The two ways a connected assistant can add to the member's record (supabase/mcp-oauth-post.sql),
// as the consent page offers them. The first is the default: the assistant shows what it will add and
// the member's yes in the chat is the approval. "Drafts only" keeps everything waiting in Brazework.
export const CONSENT_MODES = [
  { value: "chat", label: "Add it when I say yes in chat", detail: "It shows you exactly what it will add (a post, a milestone, a project) and asks first. Nothing happens without your yes." },
  { value: "drafts", label: "Drafts only", detail: "Everything waits in Brazework → Drafts for you to edit and approve." },
] as const;
export type ConsentMode = (typeof CONSENT_MODES)[number]["value"];
/** The form's answer: posting only when the member's form said "chat" (a page shown without the choice drafts). */
export const canPostFor = (mode: unknown): boolean => mode === "chat";
