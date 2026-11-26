// Torch starts a club or a study group (propose_club, 2026-11-26): the last thing a member could do by
// hand that Torch couldn't prepare. Torch drafts the card; the member edits it and confirms; the club is
// made by the same code as the Start a community page (communities/actions.ts makeCommunity).
// Pure: no database here, so it is tested on its own (tests/torch-club.test.ts).
import { COMMUNITY_FIELDS, LIMITS } from "@/lib/communities";
import { ALL_TOPICS } from "@/lib/forge";
import { STUDY_LIMITS, currentTerm } from "@/lib/study";

/** The kinds Torch starts. A school & alumni community needs the school's say, so it stays a page of its own. */
export const TORCH_CLUB_TYPES = ["field", "study", "project"] as const;
export type TorchClubType = (typeof TORCH_CLUB_TYPES)[number];

export type ClubDraft = {
  name: string; about: string; field: string; club_type: TorchClubType; privacy: "public" | "approval";
  topics: string[]; course: string; term: string; meets: string;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").replace(/[<>]/g, "").trim().slice(0, max).trim() : "");

/**
 * Torch's draft, checked the way the Start a community form checks it. A study group needs its course;
 * its term defaults to this one. An unknown field falls back to "Any field", unknown topics are dropped.
 */
export function cleanClubDraft(a: Record<string, unknown>, now: number): ClubDraft | { error: string } {
  const name = text(a.name, LIMITS.name);
  if (name.length < 3) return { error: "A club needs a name of at least 3 characters." };
  const about = text(a.about, LIMITS.about);
  if (!about) return { error: "Add a sentence about what the club is for." };
  const club_type = TORCH_CLUB_TYPES.find((t) => t === a.type) ?? "field";
  const course = club_type === "study" ? text(a.course, STUDY_LIMITS.course) : "";
  if (club_type === "study" && course.length < 2) return { error: "A study group needs its course, like CHEM 201. Ask the member which course." };
  const field = COMMUNITY_FIELDS.find((f) => typeof a.field === "string" && f.toLowerCase() === a.field.trim().toLowerCase()) ?? "Any field";
  const topics = [...new Set((Array.isArray(a.topics) ? a.topics : []).filter((t): t is string => typeof t === "string" && ALL_TOPICS.includes(t)))].slice(0, LIMITS.topics);
  return {
    name, about, field, club_type,
    privacy: a.privacy === "approval" ? "approval" : "public",
    topics,
    course,
    term: club_type === "study" ? text(a.term, STUDY_LIMITS.term) || currentTerm(now) : "",
    meets: club_type === "study" ? text(a.meets, STUDY_LIMITS.meets) : "",
  };
}

/** The draft as the Start a community form would post it, so both go through one server path. */
export function clubForm(d: ClubDraft): FormData {
  const f = new FormData();
  f.set("name", d.name); f.set("about", d.about); f.set("field", d.field); f.set("type", d.club_type); f.set("privacy", d.privacy); f.set("rules", "");
  d.topics.forEach((t) => f.append("topics", t));
  if (d.club_type === "study") { f.set("course", d.course); f.set("term", d.term); f.set("meets", d.meets); }
  return f;
}
