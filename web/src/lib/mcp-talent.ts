import { buildBuilders, rankBuilders, type Person, type VerifiedRow } from "@/lib/talent";

// find_builders over MCP (supabase/tool-talent.sql, docs/mcp-workflows.md): the rows /talent reads,
// ranked by /talent's own code (lib/talent.ts), so a company sees the same people in the same order in
// Claude as on the page. Pure, so it's tested (tests/tool-actions.test.ts).

export type TalentData = { org: { name: string; type: string }; rows: VerifiedRow[]; people: Person[] };
export type TalentAsk = { query?: string; field?: string; club?: string; open_to?: string; class_year?: number; min_signed?: number; level?: "signed" | "signed_or_backed" };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The tool's arguments, checked. */
export function talentAsk(i: Record<string, unknown>): TalentAsk {
  const year = typeof i.class_year === "number" && i.class_year >= 1950 && i.class_year <= 2100 ? Math.round(i.class_year) : undefined;
  const min = typeof i.min_signed === "number" && i.min_signed >= 1 ? Math.min(20, Math.round(i.min_signed)) : undefined;
  return {
    query: clean(i.query, 120) || undefined, field: clean(i.field, 60) || undefined, club: clean(i.club, 120) || undefined,
    open_to: clean(i.open_to, 20) || undefined, class_year: year, min_signed: min, level: i.level === "signed_or_backed" ? "signed_or_backed" : "signed",
  };
}

/** Ranked like /talent; at most 10, each with its signed work and where to see them. */
export function findBuilders(d: TalentData, a: TalentAsk) {
  const all = buildBuilders(d.rows, d.people);
  // A club by name or id: /talent filters by id; a member names it.
  const clubs = [...new Map(all.flatMap((b) => b.clubs).map((c) => [c.id, c])).values()];
  const club = a.club ? clubs.find((c) => c.id === a.club || c.name.toLowerCase() === a.club!.toLowerCase())?.id ?? "\u0000none" : "";
  const backed = a.level === "signed_or_backed";
  const list = rankBuilders(all, { q: [a.query, a.field].filter(Boolean).join(" "), club, openTo: a.open_to ?? "", min: a.min_signed ?? 1, year: a.class_year ?? 0, backed });
  return {
    company: d.org.name,
    total: list.length,
    builders: list.slice(0, 10).map((b) => ({
      name: `${b.person.first_name} ${b.person.last_name}`.trim(), headline: b.person.headline, field: b.person.field,
      class_of: b.person.grad_year ?? null, signed: b.verified, ...(backed && { backed_by_github: b.backed }),
      clubs: b.clubs.map((c) => c.name), skills: b.skills.slice(0, 10), open_to: b.person.open_to ?? [],
      work: b.latest.filter((r) => backed || !r.backed).slice(0, 3).map((r) => ({
        title: r.title, project: r.projects?.title ?? "",
        ...(r.backed ? { level: "backed by GitHub, not signed" } : { level: "signed", signed_by: r.reviewer_name || r.community_name, ...(r.reviewer_role && { role: r.reviewer_role }) }),
      })),
      url: `/u/${b.person.id}`,
    })),
    clubs_in_results: clubs.map((c) => c.name).sort(),
    next: list.length
      ? "Open a profile to see all of their signed work. A message from a company lands in their Requests, so they choose whether to reply. Search the same way in Brazework at /talent."
      : "No one matches all of that. Try fewer words, another club, or level signed_or_backed.",
  };
}
