// Find builders: companies search people by work their clubs verified, never by self-reported
// keywords. Only public data goes in: verified milestones the member made public, and the profile
// fields every member can already see. Pure functions so the ranking is tested (tests/talent.test.ts).

export type VerifiedRow = {
  id: string;
  owner_id: string;
  community_id: string | null;
  community_name: string;
  title: string;
  reviewer_name: string;
  reviewer_role?: string | null;
  reviewed_at: string | null;
  projects: { title: string; tags: string[] | null; tools: string[] | null } | null;
};

export type Person = { id: string; first_name: string; last_name: string; headline: string; field: string; open_to?: string[] | null };

export type Builder = {
  person: Person;
  verified: number;
  clubs: { id: string; name: string }[];
  skills: string[];
  latest: VerifiedRow[];
  lastVerifiedAt: number;
};

export type TalentFilters = { q?: string; club?: string; openTo?: string; min?: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

// One entry per person with at least one public verified milestone.
export function buildBuilders(rows: VerifiedRow[], people: Person[]): Builder[] {
  const who = new Map(people.map((p) => [p.id, p]));
  const by = new Map<string, Builder>();
  for (const r of rows) {
    const person = who.get(r.owner_id);
    if (!person) continue;
    let b = by.get(r.owner_id);
    if (!b) by.set(r.owner_id, (b = { person, verified: 0, clubs: [], skills: [], latest: [], lastVerifiedAt: 0 }));
    b.verified += 1;
    if (r.community_id && !b.clubs.some((c) => c.id === r.community_id)) b.clubs.push({ id: r.community_id, name: r.community_name });
    const skills = [...(r.projects?.tools ?? []), ...(r.projects?.tags ?? [])];
    // Skills ordered by how often verified work used them.
    for (const s of skills) if (!b.skills.includes(s)) b.skills.push(s);
    b.latest.push(r);
    b.lastVerifiedAt = Math.max(b.lastVerifiedAt, r.reviewed_at ? Date.parse(r.reviewed_at) : 0);
  }
  for (const b of by.values()) b.latest.sort((x, y) => Date.parse(y.reviewed_at ?? "0") - Date.parse(x.reviewed_at ?? "0"));
  return [...by.values()];
}

// Every word must appear somewhere in the person's verified work or public profile.
export function matches(b: Builder, f: TalentFilters): boolean {
  if (f.min && b.verified < f.min) return false;
  if (f.club && !b.clubs.some((c) => c.id === f.club)) return false;
  if (f.openTo && !(b.person.open_to ?? []).includes(f.openTo)) return false;
  const words = norm(f.q ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([
    b.person.headline, b.person.field, ...b.skills, ...b.clubs.map((c) => c.name),
    ...b.latest.flatMap((r) => [r.title, r.projects?.title ?? ""]),
  ].join(" "));
  return words.every((w) => hay.includes(w));
}

// Most verified work first; ties go to whoever was verified most recently.
export function rankBuilders(list: Builder[], f: TalentFilters): Builder[] {
  return list.filter((b) => matches(b, f)).sort((a, b) => b.verified - a.verified || b.lastVerifiedAt - a.lastVerifiedAt);
}
