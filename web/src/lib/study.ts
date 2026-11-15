// Study groups (supabase/study-groups.sql): a club for one course and one term, and proof for the
// people who lead them. Pure helpers here; the actions are in lib/study-actions.ts.

export const STUDY_LIMITS = { course: 20, term: 24, meets: 80 } as const;

// The term a date falls in, the way students say it: Jan–May Spring, Jun–Jul Summer, Aug–Dec Fall.
export function currentTerm(now: number): string {
  const d = new Date(now);
  const m = d.getUTCMonth();
  return `${m <= 4 ? "Spring" : m <= 6 ? "Summer" : "Fall"} ${d.getUTCFullYear()}`;
}

// "CHEM 201 · Spring 2027 · Meets Tuesdays 7pm, Library 3", leaving out what's empty.
export function studyLine(c: { course?: string; term?: string; meets?: string }): string {
  return [c.course, c.term, c.meets ? `Meets ${c.meets}` : ""].filter(Boolean).join(" · ");
}

export type LeadRow = { community_id: string; leader: string; confirmed_by: string; created_at: string };

// On a study group's page: how many members confirmed each person led it, and whether you did.
export function leadCounts(rows: LeadRow[], me: string): Map<string, { n: number; mine: boolean }> {
  const out = new Map<string, { n: number; mine: boolean }>();
  for (const r of rows) {
    const cur = out.get(r.leader) ?? { n: 0, mine: false };
    out.set(r.leader, { n: cur.n + 1, mine: cur.mine || r.confirmed_by === me });
  }
  return out;
}

export type StudyProof = { community_id: string; name: string; course: string; term: string; n: number; last: string };
type ProofRow = LeadRow & { communities: { name: string; course?: string; term?: string } | { name: string; course?: string; term?: string }[] | null };

// On a profile: each study group this person led, with how many members confirmed it, newest first.
export function studyProof(rows: ProofRow[]): StudyProof[] {
  const by = new Map<string, StudyProof>();
  for (const r of rows) {
    const c = Array.isArray(r.communities) ? r.communities[0] : r.communities;
    if (!c) continue;
    const cur = by.get(r.community_id);
    if (cur) {
      cur.n += 1;
      if (r.created_at > cur.last) cur.last = r.created_at;
    } else {
      by.set(r.community_id, { community_id: r.community_id, name: c.name, course: c.course ?? "", term: c.term ?? "", n: 1, last: r.created_at });
    }
  }
  return [...by.values()].sort((a, b) => b.last.localeCompare(a.last));
}

// "Led the CHEM 201 study group" (or the group's name when it has no course).
export const ledTitle = (s: { course: string; name: string }) => (s.course ? `Led the ${s.course} study group` : `Led ${s.name}`);
export const confirmedBy = (n: number) => `Confirmed by ${n} ${n === 1 ? "member" : "members"}`;
