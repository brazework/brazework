// The record by year, under the 12-month chart on a profile (components/profile/record-years.tsx):
// one node per year that has proven work, joined in order, and for each year a plain sentence and
// its results. "Record over time" (lib/record-timeline.ts) only draws the last twelve months, so
// work dated earlier was on the record but never drawn; this is where it shows. Linear FIX-217.
//
// Pure, so the rules are tested (tests/record-years.test.ts): the server lays it out and the chart
// only draws it. The sentences are built from the record itself, never by the AI, so they can't say
// anything the record doesn't.
//
// Who sees what is the same as the 12-month chart: signed (verified) and GitHub-backed work shows to
// everyone the caller passes it for; waiting (pending) work only to the owner. The caller has already
// left out projects a visitor can't see.

const DAY = 864e5;
// What the 12-month chart reaches back to (MAX_SPAN in lib/record-timeline.ts).
const RECENT = 365 * DAY;
const YEARS = 8; // nodes drawn: eight fit a phone with a tap target each
const RESULTS = 4; // results listed under a year; the rest are counted

export type YearResult = { id: string; kind: "signed" | "backed"; title: string; by?: string; when: string; project: string; href: string };
export type RecordYear = {
  year: number;
  signed: number;
  backed: number;
  waiting: number; // the owner only
  // 0 to 1: this year's proven work against the fullest year, on a square-root scale (a node's area
  // follows the count, not its width).
  size: number;
  // True when the year before this node isn't drawn: the line into it is dashed.
  gap: boolean;
  line: string;
  results: YearResult[];
  more: number;
};
export type RecordYears = { years: RecordYear[]; proven: number; people: number; from: number; to: number; earlier: { results: number; before: number } | null };

type In = {
  now: number;
  own: boolean;
  projects: { id: string; title: string }[];
  milestones: { id: string; project_id: string; title: string; achieved_on: string; status: string; community_name: string; reviewer_name: string; vouched_by?: string; backed?: boolean }[];
};

const dayMs = (d: string) => Date.parse(d.length === 10 ? `${d}T12:00:00Z` : d);
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
// "Sam Okafor, Operations Manager · northclinic.org" is who signed, in full; a sentence only has room
// for the name.
const short = (by: string) => by.split(/[,·]/)[0].trim();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Ana", "Ana and Ben", "Ana, Ben and 2 others".
export function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${plural(names.length - 2, "other")}`;
}

export function buildYears({ now, own, projects, milestones }: In): RecordYears | null {
  const titles = new Map(projects.map((p) => [p.id, p.title]));
  type Raw = { id: string; kind: "signed" | "backed" | "waiting"; at: number; title: string; by?: string; project_id: string };
  const raw: Raw[] = [];
  for (const m of milestones) {
    const kind = m.status === "verified" ? "signed" : m.status === "logged" && m.backed ? "backed" : m.status === "pending" && own ? "waiting" : null;
    const at = dayMs(m.achieved_on);
    if (!kind || !titles.has(m.project_id) || !Number.isFinite(at) || at > now + DAY) continue;
    const by = kind === "signed" ? (m.vouched_by || [m.reviewer_name, m.community_name].filter(Boolean).join(", ")) || undefined : undefined;
    raw.push({ id: m.id, kind, at, title: m.title, by, project_id: m.project_id });
  }
  const proven = raw.filter((r) => r.kind !== "waiting");
  const yearOf = (r: Raw) => new Date(r.at).getUTCFullYear();
  // Worth drawing once the record reaches into a second year, or holds proven work the 12-month chart
  // can't show. Until then that chart already tells it.
  if (new Set(proven.map(yearOf)).size < 2 && !proven.some((r) => r.at < now - RECENT)) return null;

  const byYear = new Map<number, Raw[]>();
  for (const r of raw.sort((a, b) => a.at - b.at)) byYear.set(yearOf(r), [...(byYear.get(yearOf(r)) ?? []), r]);
  const all = [...byYear.keys()].sort((a, b) => a - b);
  const shown = all.slice(-YEARS);
  const folded = all.slice(0, -YEARS).flatMap((y) => byYear.get(y)!).filter((r) => r.kind !== "waiting");
  const most = Math.max(1, ...shown.map((y) => byYear.get(y)!.filter((r) => r.kind !== "waiting").length));
  const thisYear = new Date(now).getUTCFullYear();
  // The first year with proven work, when there is more than one: only that node says the record starts.
  const provenYears = [...new Set(proven.map(yearOf))].sort((a, b) => a - b);
  const first = provenYears.length > 1 ? provenYears[0] : null;

  const years: RecordYear[] = shown.map((year, i) => {
    const rows = byYear.get(year)!;
    const done = rows.filter((r) => r.kind !== "waiting");
    const signed = done.filter((r) => r.kind === "signed").length;
    const backed = done.length - signed;
    const waiting = rows.length - done.length;
    const on = [...new Set(done.map((r) => r.project_id))];
    const signers = [...new Set(done.flatMap((r) => (r.by ? [short(r.by)] : [])))];
    const parts: string[] = [];
    if (done.length) {
      const where = on.length === 1 ? `on ${titles.get(on[0])}` : `across ${on.length} projects`;
      const lead = year === first ? "The record starts here: " : year === thisYear ? "So far this year: " : "";
      parts.push(`${lead}${plural(done.length, "result")} proven ${where}.`);
      if (signers.length) parts.push(`Signed by ${nameList(signers)}.`);
      if (backed) parts.push(`${backed} backed by GitHub.`);
    } else {
      // The owner's own view of a year with nothing proven yet.
      parts.push(`${plural(waiting, "result")} waiting to be signed.`);
    }
    return {
      year, signed, backed, waiting,
      size: Math.sqrt(done.length / most),
      gap: i > 0 ? year - shown[i - 1] > 1 : false,
      line: parts.join(" "),
      results: done.slice(0, RESULTS).map((r) => ({ id: r.id, kind: r.kind as "signed" | "backed", title: r.title, by: r.by, when: fmt(r.at), project: titles.get(r.project_id)!, href: `/projects/${r.project_id}` })),
      more: Math.max(0, done.length - RESULTS),
    };
  });

  return {
    years,
    proven: proven.length,
    people: new Set(proven.flatMap((r) => (r.by ? [short(r.by)] : []))).size,
    // The whole proven record's span, including years folded into `earlier`.
    from: provenYears[0],
    to: provenYears[provenYears.length - 1],
    earlier: folded.length ? { results: folded.length, before: shown[0] } : null,
  };
}
