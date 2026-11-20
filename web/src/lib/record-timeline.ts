// The record timeline at the top of a profile (components/profile/record-timeline.tsx): each project
// as a lane over time, its signed results on the dates they happened. Pure, so the rules are tested
// (tests/record-timeline.test.ts) and the server does the layout; the chart only draws it.
//
// Who sees what: signed (verified) results show to everyone the caller passes them for; waiting
// (pending) ones only to the owner. The caller has already left out projects a visitor can't see.
// Updates (posts on a project) are small ticks on its lane, never a reason to draw a lane alone.

const DAY = 864e5;
const MIN_SPAN = 21 * DAY; // three weeks: a new member's first results spread out instead of crowding today
const MAX_SPAN = 365 * DAY;
const LANES = 4;
// Marks never sit on the frame's edges: x runs from PAD to 1 - PAD.
const PAD = 0.04;

// `when` is the day the work happened (where the mark sits); `signed`, the day someone signed it, which
// is what follows "Signed by" (the same date the share card shows, lib/proof-card.ts).
export type TimelineMark = { id: string; kind: "signed" | "backed" | "waiting" | "post"; at: number; x: number; title: string; by?: string; when: string; signed?: string };
export type TimelineLane = { id: string; title: string; href: string; from: number; to: number; ongoing: boolean; marks: TimelineMark[] };
export type RecordTimeline = { start: number; end: number; today: number; ticks: { x: number; label: string }[]; lanes: TimelineLane[]; more: number; signed: number; backed: number; waiting: number; since: string | null };

type In = {
  now: number;
  own: boolean;
  projects: { id: string; title: string; status: string }[];
  milestones: { id: string; project_id: string; title: string; achieved_on: string; status: string; community_name: string; reviewer_name: string; vouched_by?: string; backed?: boolean; reviewed_at?: string | null }[];
  posts: { created_at: string; project_id?: string | null }[];
};

const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
// A date-only value ("2026-11-13") read at noon UTC, so it's the same day everywhere.
const dayMs = (d: string) => Date.parse(d.length === 10 ? `${d}T12:00:00Z` : d);

export function buildTimeline({ now, own, projects, milestones, posts }: In): RecordTimeline | null {
  const titles = new Map(projects.map((p) => [p.id, p]));
  const oldest = now - MAX_SPAN;
  type Raw = Omit<TimelineMark, "x"> & { project: string };
  const raw: Raw[] = [];
  for (const m of milestones) {
    // Signed by a person; backed by GitHub with nobody asked (supabase/backed.sql); or, on your own
    // record, still waiting for someone to sign.
    const kind = m.status === "verified" ? "signed" : m.status === "logged" && m.backed ? "backed" : m.status === "pending" && own ? "waiting" : null;
    const at = dayMs(m.achieved_on);
    if (!kind || !titles.has(m.project_id) || at < oldest || at > now + DAY) continue;
    const by = kind === "signed" ? (m.vouched_by || [m.reviewer_name, m.community_name].filter(Boolean).join(", ")) : undefined;
    const signed = kind === "signed" && m.reviewed_at ? fmt(Date.parse(m.reviewed_at), { month: "short", day: "numeric", year: "numeric" }) : undefined;
    raw.push({ id: m.id, kind, at: Math.min(at, now), title: m.title, by: by || undefined, when: fmt(at, { month: "short", day: "numeric", year: "numeric" }), signed, project: m.project_id });
  }
  if (!raw.length) return null;
  const results = new Set(raw.map((r) => r.project));
  posts.forEach((p, i) => {
    const at = Date.parse(p.created_at);
    if (p.project_id && results.has(p.project_id) && at >= oldest && at <= now) raw.push({ id: `post-${i}`, kind: "post", at, title: "Update posted", when: fmt(at, { month: "short", day: "numeric" }), project: p.project_id });
  });

  const end = now;
  // A quarter more room than the record needs, so the first result isn't on the left edge either.
  const start = end - Math.min(MAX_SPAN, Math.max(MIN_SPAN, (end - Math.min(...raw.map((r) => r.at))) * 1.25));
  const x = (t: number) => PAD + (1 - 2 * PAD) * ((t - start) / (end - start));

  const byProject = new Map<string, TimelineMark[]>();
  for (const r of raw.sort((a, b) => a.at - b.at)) {
    const { project, ...mark } = r;
    byProject.set(project, [...(byProject.get(project) ?? []), { ...mark, x: x(mark.at) }]);
  }
  const all = [...byProject].map(([id, marks]) => {
    const p = titles.get(id)!;
    const ongoing = p.status === "in_progress";
    return { id, title: p.title, href: `/projects/${id}`, from: marks[0].x, to: ongoing ? x(end) : marks[marks.length - 1].x, ongoing, marks, last: marks[marks.length - 1].at };
  }).sort((a, b) => b.last - a.last);
  const lanes: TimelineLane[] = all.slice(0, LANES).map((l) => ({ id: l.id, title: l.title, href: l.href, from: l.from, to: l.to, ongoing: l.ongoing, marks: l.marks }));
  const shown = lanes.flatMap((l) => l.marks);
  const firstSigned = shown.filter((m) => m.kind === "signed").sort((a, b) => a.at - b.at)[0];

  return {
    start, end, today: x(end), lanes, more: all.length - lanes.length,
    ticks: ticks(start, end).map((t) => ({ x: x(t.at), label: t.label })),
    signed: shown.filter((m) => m.kind === "signed").length,
    backed: shown.filter((m) => m.kind === "backed").length,
    waiting: shown.filter((m) => m.kind === "waiting").length,
    since: firstSigned ? fmt(firstSigned.at, { month: "long", year: "numeric" }).replace(/^(\w{3})\w*/, "$1") : null,
  };
}

// Months for a long window (with the year on January), Mondays for a short one, at most seven.
function ticks(start: number, end: number): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  if (end - start > 120 * DAY) {
    const d = new Date(start);
    for (let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); m <= end; m = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1))
      out.push({ at: m, label: new Date(m).getUTCMonth() === 0 ? fmt(m, { month: "short", year: "numeric" }) : fmt(m, { month: "short" }) });
  } else {
    const d = new Date(start);
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
    for (let t = first; t <= end; t += 7 * DAY) out.push({ at: t, label: fmt(t, { month: "short", day: "numeric" }) });
  }
  const step = Math.ceil(out.length / 7);
  return out.filter((_, i) => i % step === 0);
}
